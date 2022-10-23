import { SESMailCommonHeaders } from 'aws-lambda';

const routeList = process.env.ROUTE_LIST as unknown as [string, string][];
let userMapping = new Map<string, string>(routeList);

export interface route {
  sender: string;
  destination: Destination;
}

class Destination {
  ToAddresses: string[] = [];
  CcAddresses: string[] = [];
  BccAddresses: string[] = [];

  addDestination(
    sourceDestination: string,
    targetDestination: string,
    commonHeaders: SESMailCommonHeaders
  ) {
    console.log(
      `sourceDest: ${sourceDestination}, targetDest: ${targetDestination}, headers: ${JSON.stringify(
        commonHeaders,
        null,
        2
      )}`
    );
    if (commonHeaders.to && commonHeaders.to.includes(sourceDestination)) {
      this.ToAddresses.push(targetDestination);
    }
    if (commonHeaders.cc && commonHeaders.cc.includes(sourceDestination)) {
      this.CcAddresses.push(targetDestination);
    }
    if (commonHeaders.bcc && commonHeaders.bcc.includes(sourceDestination)) {
      this.BccAddresses.push(targetDestination);
    }
  }
}

export function routeMail(
  sourceSender: string,
  sourceRecipients: string[],
  commonHeaders: SESMailCommonHeaders,
  userMappingOverride?: Map<string, string>
): route {
  if (userMappingOverride) {
    userMapping = userMappingOverride;
  }
  let destinationSender = '';
  let destinationRecipients = new Destination();

  sourceRecipients.forEach((sr) => {
    const recipientParts = sr.split('_');
    if (userMapping.has(sr)) {
      let proxyRecipient = userMapping.get(sr)!;
      destinationSender = formatSender(
        sourceSender,
        generateReplyAddress(sourceSender, sr),
        commonHeaders
      ); // should only need to be set once
      destinationRecipients.addDestination(sr, proxyRecipient, commonHeaders);
    } else if (userMapping.has(recipientParts[recipientParts.length - 1])) {
      if (
        userMapping.get(recipientParts[recipientParts.length - 1]) ==
        sourceSender
      ) {
        const path = parseReplyAddress(sr);
        destinationSender = formatSender(
          sourceSender,
          path.sender,
          commonHeaders
        );
        destinationRecipients.addDestination(sr, path.recipient, commonHeaders);
      }
    }
  });

  return { sender: destinationSender, destination: destinationRecipients };
}

function formatSender(
  sourceSender: string,
  targetSender: string,
  commonHeaders: SESMailCommonHeaders
): string {
  return commonHeaders.from![0].replace(sourceSender, targetSender);
}

function parseReplyAddress(address: string): {
  sender: string;
  recipient: string;
} {
  const parts = address.split('_');
  const sender = parts[parts.length - 1];
  const recipientComponent = address.substring(
    0,
    address.length - sender.length - 1
  );
  const recipient = recipientComponent.replace('_at_', '@');

  return { sender, recipient };
}

function generateReplyAddress(sender: string, recipient: string): string {
  return [sender.replace('@', '_at_'), recipient].join('_');
}
