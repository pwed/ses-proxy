#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SesProxyStack } from '../lib/ses-proxy-stack';

const app = new cdk.App();
new SesProxyStack(app, 'SesProxyStack', {
  env: { account: '806124249357', region: 'us-west-2' }, // workload
  domains: [
    'freddiestodd.art',
    'pwed.me',
    'unstacked.cloud',
    'unstacked.io',
    'unstacked.xyz',
  ],
  routes: [
    ['fred@unstacked.me', 'freddiestoddart000@gmail.com'],
    ['pwed@unstacked.me', 'freddiestoddart000@gmail.com'],
    ['fred@unstacked.xyz', 'freddiestoddart000@gmail.com'],
    ['pwed@unstacked.xyz', 'freddiestoddart000@gmail.com'],
    ['pwed@unstacked.io', 'freddiestoddart000@gmail.com'],
    ['fred@unstacked.io', 'freddiestoddart000@gmail.com'],
    ['me@freddiestodd.art', 'freddiestoddart000@gmail.com'],
    ['me@pwed.me', 'freddiestoddart000@gmail.com'],
    ['pwed@pwed.me', 'freddiestoddart000@gmail.com'],
    ['fred@pwed.me', 'freddiestoddart000@gmail.com'],
  ],
});
