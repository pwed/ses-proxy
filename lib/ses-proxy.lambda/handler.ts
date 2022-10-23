import { SESEvent, Context } from 'aws-lambda';
import { S3, SESV2 } from 'aws-sdk';
import { SendEmailRequest } from 'aws-sdk/clients/sesv2';
import { Logger, TLogLevelName } from 'tslog';
import { createTargetHeaders } from './headers';
import { routeMail } from './router';

const bucketName = process.env.S3_BUCKET_NAME!;
const logLevel = process.env.LOG_LEVEL!;

const logFather: Logger = new Logger({
  minLevel: logLevel as TLogLevelName,
  type: 'json',
  displayInstanceName: false,
  displayFilePath: 'hidden',
});

const s3 = new S3();
const ses = new SESV2();

exports.handler = async function (
  event: SESEvent,
  context: Context,
  callback: any
) {
  const sesNotification = event.Records[0].ses;
  const messageId = sesNotification.mail.messageId;
  const log = logFather.getChildLogger({ requestId: context.awsRequestId });
  const source = sesNotification.mail.source;
  const sourceDomain = source.split('@')[1];
  const sourceHeaders = sesNotification.mail.headers;
  const sourceCommonHeaders = sesNotification.mail.commonHeaders;
  const destination = sesNotification.receipt.recipients;

  log.debug(event);
  log.debug(context);
  log.debug(callback);

  // Retrieve the email from your bucket
  const s3Data = await s3
    .getObject({
      Bucket: bucketName,
      Key: messageId,
    })
    .promise();
  const rawEamil = s3Data.Body!.toString();
  log.debug('object length', rawEamil.length);
  const originalHeaders = rawEamil.split(/(\r\n|\r|\n){2}/, 1)[0];
  log.debug('header length', originalHeaders.length);
  const originalBody = rawEamil.substring(originalHeaders.length + 3);

  log.debug('original email headers', originalHeaders);
  log.silly('original body', originalBody);

  const destinationDomain = destination[0].split('@')[1];
  log.debug('Source/destination', source, destination);

  const targetRoute = routeMail(source, destination, sourceCommonHeaders);
  log.debug('route', targetRoute);

  let headers = createTargetHeaders(sourceHeaders);
  const Data = headers + '\r\n' + originalBody;

  log.debug('new headers', headers);

  let params: SendEmailRequest = {
    FromEmailAddress: targetRoute.sender,
    Destination: targetRoute.destination,
    Content: {
      Raw: {
        Data,
      },
    },
    ReplyToAddresses: [targetRoute.sender],
  };
  log.debug('ses params', params);

  const response = await ses.sendEmail(params).promise();
  log.debug('ses response', response);
};
