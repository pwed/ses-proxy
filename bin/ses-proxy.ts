#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SesProxyStack } from '../lib/ses-proxy-stack';

const app = new cdk.App();
new SesProxyStack(app, 'SesProxyStack', {
  env: { account: '806124249357', region: 'us-west-2' }, // workload
});