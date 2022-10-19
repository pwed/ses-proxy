import { join } from 'path';
import { SESEvent } from 'aws-lambda';
import { S3, SESV2 } from 'aws-sdk';
import { SendEmailRequest } from 'aws-sdk/clients/sesv2';
import { Logger, TLogLevelName } from 'tslog';
import { routeMail } from './router';

const bucketName = process.env.S3_BUCKET_NAME!;
const logLevel = process.env.LOG_LEVEL!;

const logFather: Logger = new Logger({
  minLevel: logLevel as TLogLevelName,
  type: 'json',
  displayInstanceName: false,
});

const s3 = new S3();
const ses = new SESV2();

//TODO: Deliver to multiple destinations correctly

function cleanHeaders(
  sourceHeaders: { name: string; value: string }[]
): { name: string; value: string }[] {
  let newHeaders: { name: string; value: string }[] = [];

  const keys = ['Content-Type', 'Subject', 'MIME-Version'];

  sourceHeaders.forEach((header) => {
    if (keys.includes(header.name)) {
      newHeaders.push(header);
    }
  });

  return newHeaders;
}

exports.handler = async function (
  event: SESEvent,
  context: any,
  callback: any
) {
  const sesNotification = event.Records[0].ses;
  const messageId = sesNotification.mail.messageId;
  const log = logFather.getChildLogger({ requestId: messageId });
  const source = sesNotification.mail.source;
  const sourceDomain = source.split('@')[1];
  const sourceHeaders = sesNotification.mail.headers;
  const sourceCommonHeaders = sesNotification.mail.commonHeaders;
  const destination = sesNotification.mail.destination[0];
  const destinationDomain = destination.split('@')[1];

  log.debug('notification', sesNotification);

  let targetRoute = routeMail({ sender: source, destination });

  let newHeaders = cleanHeaders(sourceHeaders);
  newHeaders.push({ name: 'Return-Path', value: targetRoute.sender });
  newHeaders.push({ name: 'To', value: targetRoute.destination });
  let headers = '';
  newHeaders.forEach((header) => {
    headers += `${header.name}: ${header.value}\r\n`;
  });

  // Retrieve the email from your bucket
  const s3Data = await s3
    .getObject({
      Bucket: bucketName,
      Key: join(destinationDomain, sesNotification.mail.messageId),
    })
    .promise();
  const rawEamil = s3Data.Body!.toString();
  log.debug('object length', rawEamil.length);
  const originalHeaders = rawEamil.split(/(\r\n|\r|\n){2}/, 1)[0];
  log.debug('header length', originalHeaders.length);
  const originalBody = rawEamil.substring(originalHeaders.length + 3);
  const Data = headers + '\r\n' + originalBody;

  log.debug('original email headers', originalHeaders);
  log.debug('new headers', headers);
  log.silly('original body', originalBody);

  const params: SendEmailRequest = {
    FromEmailAddress: sourceCommonHeaders.from![0].replace(
      source,
      targetRoute.sender
    ),
    Destination: {
      ToAddresses: [targetRoute.destination],
    },
    Content: {
      Raw: {
        Data,
      },
    },
  };
  log.debug('ses params', params);

  const response = await ses.sendEmail(params).promise();
  log.debug('ses response', response);
};
