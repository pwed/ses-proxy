import { route } from './router';

const REQUIRED_HEADERS = [
  'Content-Type',
  'Subject',
  'MIME-Version',
  // 'To',
  // 'Cc',
  // 'Bcc',
];

interface header {
  name: string;
  value: string;
}

export function createTargetHeaders(sourceHeaders: header[]): string {
  let newHeaders: header[] = [];

  sourceHeaders.forEach((header) => {
    if (REQUIRED_HEADERS.includes(header.name)) {
      newHeaders.push(header);
    }
  });

  let headerText = '';
  newHeaders.forEach((header) => {
    headerText += `${header.name}: ${header.value}\r\n`;
  });
  return headerText;
}
