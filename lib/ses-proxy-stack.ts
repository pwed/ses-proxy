import {
  Stack,
  StackProps,
  aws_route53 as r53,
  aws_ses as ses,
  aws_ses_actions as actions,
  aws_s3 as s3,
  aws_lambda as lambda,
  aws_lambda_nodejs,
  aws_iam as iam,
  RemovalPolicy,
  Duration,
  custom_resources,
} from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { join } from 'path';
import { TLogLevelName } from 'tslog';

export interface SesProxyStackProps extends StackProps {
  domains: string[];
  routes: [string, string][];
  lambdaLogLevel?: TLogLevelName;
}

const SesProxyStackPropsDefaults = {
  lambdaLogLevel: 'warn' as TLogLevelName,
};

export class SesProxyStack extends Stack {
  private props: SesProxyStackProps;

  constructor(scope: Construct, id: string, props: SesProxyStackProps) {
    super(scope, id, props);

    this.props = { ...SesProxyStackPropsDefaults, ...props };

    const bucket = new s3.Bucket(this, 'Bucket', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: Duration.days(7),
        },
      ],
    });

    const proxyFunction = new aws_lambda_nodejs.NodejsFunction(
      this,
      'ProxyFunction',
      {
        entry: join(__dirname, 'ses-proxy.lambda', 'handler.ts'),
        handler: 'handler',
        depsLockFilePath: join(__dirname, '..', 'package-lock.json'),
        environment: {
          S3_BUCKET_NAME: bucket.bucketName,
          LOG_LEVEL: this.props.lambdaLogLevel as TLogLevelName,
        },
        logRetention: RetentionDays.ONE_WEEK,
        timeout: Duration.seconds(20),
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
        bundling: {
          sourceMap: true,
          sourceMapMode: aws_lambda_nodejs.SourceMapMode.EXTERNAL,
          minify: true,
          define: {
            'process.env.ROUTE_LIST': JSON.stringify(this.props.routes), // temp until we add dynamo
          },
        },
      }
    );
    bucket.grantReadWrite(proxyFunction);
    proxyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendRawEmail'],
        resources: ['*'],
      })
    );
    proxyFunction.grantInvoke(new iam.ServicePrincipal('ses.amazonaws.com'));

    const sesReceiptRuleSet = new ses.ReceiptRuleSet(this, 'SESReceiptRuleSet');
    new ses.DropSpamReceiptRule(this, 'SpamRule', {
      ruleSet: sesReceiptRuleSet,
      scanEnabled: true,
    });

    const enableSesReceiver = new custom_resources.AwsCustomResource(
      this,
      'EnableSesReceiver',
      {
        onUpdate: {
          service: 'SES',
          action: 'setActiveReceiptRuleSet',
          parameters: {
            RuleSetName: sesReceiptRuleSet.receiptRuleSetName,
          },
          physicalResourceId: custom_resources.PhysicalResourceId.of(
            sesReceiptRuleSet.receiptRuleSetName
          ),
        },
        policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['ses:SetActiveReceiptRuleSet'],
            resources: ['*'],
            effect: iam.Effect.ALLOW,
          }),
        ]),
      }
    );

    this.props.domains.forEach((domain) => {
      this.provisionDomain(domain);
      new ses.ReceiptRule(this, `RecieptRule${domain}`, {
        ruleSet: sesReceiptRuleSet,
        recipients: [domain],
        actions: [
          new actions.S3({
            bucket,
            objectKeyPrefix: domain,
          }),
          new actions.Lambda({
            function: proxyFunction,
            invocationType: actions.LambdaInvocationType.EVENT,
          }),
        ],
      });
    });

    bucket.grantPut(new iam.ServicePrincipal('ses.amazonaws.com'));
  }

  provisionDomain(domainName: string) {
    const zone = r53.HostedZone.fromLookup(this, `Zone${domainName}`, {
      domainName,
    });

    const sesIdentity = new ses.EmailIdentity(
      this,
      `SESIdentity${domainName}`,
      {
        identity: ses.Identity.publicHostedZone(zone),
        dkimSigning: true,
        mailFromDomain: `mail.${domainName}`,
      }
    );

    const mxRecord = new r53.MxRecord(this, `MX${domainName}`, {
      zone,
      values: [
        { priority: 10, hostName: `inbound-smtp.${this.region}.amazonaws.com` },
      ],
    });

    const spfRecord = new r53.TxtRecord(this, `SPF${domainName}`, {
      zone,
      values: ['v=spf1 include:amazonses.com ~all'],
    });

    const dmarcRecord = new r53.TxtRecord(this, `DMARC${domainName}`, {
      zone,
      recordName: `_DMARC.${domainName}`,
      values: [
        //TODO: need to add destinations for this mailbox
        `v=DMARC1; p=none; rua=mailto:postmaster@${domainName}; ruf=mailto:postmaster@${domainName}; fo=1`,
      ],
    });
  }
}
