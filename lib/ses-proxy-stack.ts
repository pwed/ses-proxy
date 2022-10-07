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
} from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { join } from "path";

export class SesProxyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domains = [
      "unstacked.xyz",
      "unstacked.io",
      "unstacked.cloud",
      "unstacked.me",
      "unstacked.media",
      "unstacked.online",
      "pwed.me",
      "freddiestodd.art",
    ];

    const bucket = new s3.Bucket(this, "Bucket", {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const proxyFunction = new aws_lambda_nodejs.NodejsFunction(
      this,
      "ProxyFunction",
      {
        entry: join(__dirname, "ses-proxy.lambda", "handler.ts"),
        handler: "handler",
        depsLockFilePath: join(__dirname, "..", "package-lock.json"),
        environment: {
          S3_BUCKET_NAME: bucket.bucketName,
        },
        logRetention: RetentionDays.ONE_WEEK,
        timeout: Duration.seconds(20),
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
      }
    );
    bucket.grantReadWrite(proxyFunction);
    proxyFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendRawEmail"],
        resources: ["*"],
      })
    );
    proxyFunction.grantInvoke(new iam.ServicePrincipal("ses.amazonaws.com"));

    const sesReciever = new ses.ReceiptRuleSet(this, "SESReciever");

    domains.forEach((domain) => {
      this.provisionDomain(domain);
      new ses.ReceiptRule(this, `RecieptRule${domain}`, {
        ruleSet: sesReciever,
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

    bucket.grantPut(new iam.ServicePrincipal("ses.amazonaws.com"));
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
      }
    );

    const mxRecord = new r53.MxRecord(this, `MX${domainName}`, {
      zone,
      values: [
        { priority: 10, hostName: `inbound-smtp.${this.region}.amazonaws.com` },
      ],
    });
  }
}
