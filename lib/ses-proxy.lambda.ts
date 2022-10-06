import { S3, SESV2 } from "aws-sdk";
import { SESEvent } from "aws-lambda";
import { SendEmailRequest } from "aws-sdk/clients/sesv2";
import { join } from "path";
const s3 = new S3();
const ses = new SESV2();

const bucketName = process.env.S3_BUCKET_NAME!;
let userMapping = new Map<string, string>([
  ["pwed@unstacked.xyz", "freddiestoddart000@gmail.com"],
  ["fred@unstacked.xyz", "freddiestoddart000+fred@gmail.com"],
]);

interface parsedDestination {
  // outbound: boolean;
  sender: string;
  recipient: string;
}

function parseDestination(address: string): parsedDestination {
  const sender = address.split("_")[-1];
  const recipientComponent = address.substring(
    0,
    address.length - sender.length
  );
  const recipient = recipientComponent.replace("_at_", "@");

  return { sender, recipient };
}

function generateSenderAddress(sender: string, reciever: string): string {
  return [sender.replace("@", "_at_"), reciever].join("_");
}

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
  console.log("SES Notification:\n", JSON.stringify(sesNotification, null, 2));

  // Retrieve the email from your bucket
  const s3Data = await s3
    .getObject({
      Bucket: bucketName,
      Key: join("unstacked.xyz", sesNotification.mail.messageId),
    })
    .promise();

  const rawEamil = s3Data.Body!.toString();
  const origonalHeaders = rawEamil.split(/\n\s*\n/)[0];
  let headerMap = new Map<string, string>();
  origonalHeaders.split("\n").forEach((line) => {
    let parts = line.split(": ");
    console.log(parts);
    if (parts[1]) {
      headerMap.set(parts[0], parts[1].trim());
    }
  });
  let newHeaderMap = cleanHeaders(headerMap);
  let headers = "";
  newHeaderMap.forEach((v, k) => {
    headers += k + ": " + v + "\n";
  });
  // headers += "From: " + headerMap.get("From")?.replace(/\<.*\>/, "<"+generateSenderAddress(
  //   sesNotification.mail.source,
  //   sesNotification.mail.destination[0]
  // )) + ">\n"
  const originalBody = rawEamil.substring(origonalHeaders.length);
  const Data = headers + originalBody;

  console.log("Original email:\n" + s3Data.Body);

  console.log("New email:\n" + Data);
  const params: SendEmailRequest = {
    FromEmailAddress:
      headerMap
        .get("From")
        ?.replace(
          /\<.*\>/,
          "<" +
            generateSenderAddress(
              sesNotification.mail.source,
              sesNotification.mail.destination[0]
            )
        ) + ">",
    Destination: {
      ToAddresses: [userMapping.get(sesNotification.mail.destination[0])!],
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
