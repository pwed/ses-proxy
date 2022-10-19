const routeList = process.env.ROUTE_LIST as unknown as [string, string][];
const userMapping = new Map<string, string>(routeList);

interface route {
  sender: string;
  destination: string;
}

export function routeMail(recievedRoute: route): route {
  let sender = '';
  let destination = '';
  const destinationParts = recievedRoute.destination.split('_');
  if (userMapping.has(recievedRoute.destination)) {
    destination = userMapping.get(recievedRoute.destination)!;
    sender = generateSenderAddress(
      recievedRoute.sender,
      recievedRoute.destination
    );
  } else if (userMapping.has(destinationParts[destinationParts.length - 1])) {
    if (
      userMapping.get(destinationParts[destinationParts.length - 1]) ==
      recievedRoute.sender
    ) {
      return parseDestination(recievedRoute.destination);
    }
  }

  return { sender, destination };
}

function parseDestination(address: string): route {
  const parts = address.split('_');
  const sender = parts[parts.length - 1];
  const recipientComponent = address.substring(
    0,
    address.length - sender.length - 1
  );
  const recipient = recipientComponent.replace('_at_', '@');

  return { sender, destination: recipient };
}

function generateSenderAddress(sender: string, destination: string): string {
  return [sender.replace('@', '_at_'), destination].join('_');
}
