import { S3, SESV2 } from "aws-sdk";
import { SESEvent } from "aws-lambda";
import { SendEmailRequest } from "aws-sdk/clients/sesv2";
import { join } from "path";
import { routeMail } from "./router";

const s3 = new S3();
const ses = new SESV2();

const bucketName = process.env.S3_BUCKET_NAME!;


//TODO: Implement outbound mail
//TODO: Deliver to multiple destinations correctly



function cleanHeaders(headerMap: Map<string, string>): Map<string, string> {
  let newHeaderMap = new Map<string, string>();

  const keys = ["Content-Type", "Subject", "MIME-Version"];

  keys.forEach((key) => {
    if (headerMap.has(key)) {
      newHeaderMap.set(key, headerMap.get(key)!);
    }
  });

  return newHeaderMap;
}

exports.handler = async function (
  event: SESEvent,
  context: any,
  callback: any
) {
  console.log("Process email");

  const sesNotification = event.Records[0].ses;
  const source = sesNotification.mail.source
  const destination = sesNotification.mail.destination[0]
  const sourceDomain = source.split("@")[1]
  const destinationDomain = destination.split("@")[1]
  const messageId = sesNotification.mail.messageId
  const sourceHeaders = sesNotification.mail.headers
  const sourceCommonHeaders = sesNotification.mail.commonHeaders
  console.log("SES Notification:\n", JSON.stringify(sesNotification, null, 2));

  let targetRoute = routeMail({sender: source, destination})

  // Retrieve the email from your bucket
  const s3Data = await s3
    .getObject({
      Bucket: bucketName,
      Key: join(destinationDomain, sesNotification.mail.messageId),
    })
    .promise();

  const rawEamil = s3Data.Body!.toString();
  const origonalHeaders = rawEamil.split(/\n\s*\n/)[0];
  let headerMap = new Map<string, string>();

  //TODO: Parse multiline headers correctly
  origonalHeaders.split("\n").forEach((line, index) => {
    let parts = line.split(": ");
    if (parts[1]) {
      headerMap.set(parts[0], parts.slice(1).join(": ").trim());
    }
  });
  let newHeaderMap = cleanHeaders(headerMap);
  newHeaderMap.set("Return-Path", targetRoute.sender)
  newHeaderMap.set("To", targetRoute.destination)
  let headers = "";
  newHeaderMap.forEach((v, k) => {
    headers += k + ": " + v + "\n";
  });
  const originalBody = rawEamil.substring(origonalHeaders.length);
  const Data = headers + originalBody;

  console.log("Original email headers:\n" + origonalHeaders);

  console.log("New email headers:\n" + headers);
  const params: SendEmailRequest = {
    FromEmailAddress:
      sourceCommonHeaders.from![0].replace(
         source,
          targetRoute.sender),
    Destination: {
      ToAddresses: [targetRoute.destination],
    },
    Content: {
      Raw: {
        Data,
      },
    },
  };
  const response = await ses.sendEmail(params).promise();
  console.log(origonalHeaders);
  console.log(originalBody);
  console.log("SES Params: " + JSON.stringify(params, null, 2));
  console.log("SES Response: " + JSON.stringify(response, null, 2));
};
