import * as SesProxy from '../lib/ses-proxy.lambda/router';

test('Route Mail', () => {
  const route = SesProxy.routeMail(
    'freddiestoddart000@gmail.com',
    ['pwed@pwed.me'],
    {
      to: ['pwed@pwed.me'],
      from: ['freddiestoddart000@gmail.com'],
      returnPath: 'freddiestoddart000@gmail.com',
      date: '',
      messageId: '',
    },
    new Map<string, string>([['pwed@pwed.me', 'fred@test.com']])
  );
  console.log(route);
  expect(route.destination.ToAddresses[0]).toBe('fred@test.com');
});
