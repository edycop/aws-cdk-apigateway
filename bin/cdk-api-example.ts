#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkApiExampleStack } from '../lib/cdk-api-example-stack';

const app = new cdk.App();
new CdkApiExampleStack(app, 'CdkApiExampleStack');
