# Serverless vs SST vs SAM Research

I want to understand the landscape of creating Lambda function-based Micro-Services.

I know we use Serverless at work.. fine. But I know the new version (4) requires logging in to their service and even thought it's meant so they can charge customers with more than 2M/yr in ARR, it has rubbed some people the wrong way. Also, depending on what they charge for those customers, the company I work for may be in aht 2M-ARR/yr, so they may look elsewhere.

I heard SST was the community fork of serverless, when the company decided to charge. 

And I hear SAM is Amazon's offering in the same space.

## And what space would that be?

I *believe* that all these tools facilitate impersonating the AWS back-end, while developing locally. I don't know to what extent they are involved in the deployment of these services or what those services all are? Lambda I know, but what about EKS? Can you test a kubernmetes cluster and a database container/cluster all running locally as if it were in the cloud? I'd imagine it would help when tracking down coordination bugs.

So that's part number one: What IS their space? Does it have a name? Any other players in it? Who *are* the players? What companies own them? Potential for other changes like the Serverless 3->4?

## Next... What are the most used things?

What are the most used functions of these... platforms? And how do they stack up, in terms of those functions.

Give me a blog post run down of this information. Cover as much breadth as possible, but stay fairly shallow. I want to get a good sense of what these tools DO, which one does which function better, and which are the most used?

### == AI Response ==
2:38 AMThe Lambda Microservices Tooling Landscape: Serverless, SST, and SAM
What Space Are We Even Talking About?
The generic term is Infrastructure as Code (IaC) for serverless, but more specifically these are serverless development frameworks. They handle:

Local development/testing - Mock AWS services locally
Infrastructure definition - Define your Lambdas, APIs, databases, etc. in code
Deployment - Package and push everything to AWS
Observability - Some logging/monitoring integration

You're right that they help you run stuff locally that mimics AWS, but the deployment and infrastructure management is actually the bigger deal for most teams.
The Players
Serverless Framework

Company: Serverless Inc. (VC-backed startup)
What happened: v3 was open source. v4 requires login + telemetry, free under $2M ARR
Risk: They're a startup that needs revenue. Pricing could change, features could get paywalled
Market position: Most established, huge plugin ecosystem

SST (Serverless Stack)

Company: Independent (venture-backed)
What happened: Started as a Serverless Framework wrapper, became its own thing. Not a fork - built from scratch
Focus: Modern DX with TypeScript-first, live Lambda development, better type safety
Risk: Smaller team, also VC-backed and will need monetization eventually

AWS SAM (Serverless Application Model)

Company: Amazon
What happened: AWS's official answer to Serverless Framework
Risk: Low - Amazon won't rug-pull you, but they might neglect it or pivot
Downside: AWS-only (obviously), more verbose, slower-moving

Terraform + Serverless

Company: HashiCorp (now IBM-owned after acquisition)
What happened: Terraform changed license to BSL, forked to OpenTofu
Use case: General IaC, can do serverless but not specialized for it
Risk: IBM ownership uncertainty, license drama already happened

Pulumi

Company: Pulumi Corp (VC-backed)
Approach: Real programming languages (TypeScript, Python, Go) instead of YAML
Risk: Another VC-backed startup, but has enterprise customers

What Do These Tools Actually Do?
Core Functions (Ranked by Usage)
1. Infrastructure Definition

Define Lambdas, API Gateway, DynamoDB, S3, etc. in config files
Winner: SST (TypeScript, type-safe)
Runner-up: Serverless (YAML, huge ecosystem)
AWS Official: SAM (verbose but complete AWS coverage)

2. Local Development

Run Lambdas locally, mock AWS services
Winner: SST (live Lambda dev is slick - updates in real AWS without redeploy)
Runner-up: Serverless (plugins for local testing)
Meh: SAM (local invoke works but clunky)

3. Deployment

Package code, upload to S3, create/update CloudFormation stacks
Winner: Tie - they all do this fine
Note: SAM uses CloudFormation directly, others generate it

4. Multi-Environment Management

Dev/staging/prod with different configs
Winner: Serverless (mature stage/environment handling)
Runner-up: SST (good but younger)
Basic: SAM (you'll do more manual work)

5. Observability/Monitoring

Logs, metrics, debugging
Winner: SST (built-in console, great DX)
Runner-up: Serverless (integrations available)
AWS Native: SAM (uses CloudWatch, X-Ray - fine but basic)

What About Kubernetes/EKS?
Plot twist: These tools are for serverless (Lambda, API Gateway, etc.), not containers/Kubernetes. Different universe.

Lambda: You write functions, AWS manages servers
EKS/Kubernetes: You manage container orchestration (even if AWS runs the control plane)

For EKS, you'd use:

kubectl + helm for deployments
minikube or kind for local Kubernetes
Terraform/Pulumi for EKS cluster IaC

Some tools (like SST) let you define EKS resources, but that's just IaC - not local testing of Kubernetes.
Market Share (Rough Estimates)

Serverless Framework - ~60% of serverless IaC users (most GitHub stars, oldest)
AWS SAM - ~25% (enterprises that drink AWS Kool-Aid)
SST - ~10% (growing fast, developer darling)
Others (Terraform, Pulumi for serverless) - ~5%

Most Used Features (Across All Tools)

Lambda function definition and deployment
API Gateway REST/HTTP API setup
DynamoDB table creation
S3 bucket management
Event triggers (SQS, SNS, EventBridge)
Environment variables and secrets
IAM role/policy generation
CloudFormation stack management

Quick Comparison
FeatureServerlessSSTSAMConfig LanguageYAMLTypeScriptYAMLLocal DevPlugin-basedLive LambdaBasic invokeType SafetyNoneExcellentNoneLearning CurveMediumMediumSteeperVendor LockNone (multi-cloud)AWS-onlyAWS-onlyLogin Requiredv4+NoNoEcosystemHugeGrowingAWS official
Bottom Line

Most companies use: Serverless Framework (v3 still works fine)
Best DX: SST if you're TypeScript-first
Safest long-term: SAM (AWS won't abandon it) or OpenTofu/Terraform (open source fork)
Your $2M ARR concern: Valid. Serverless Inc could change pricing anytime

If your company might hit that revenue threshold, I'd either:

Stay on Serverless v3 (still supported)
Evaluate SST migration (modern, no login)
Consider SAM if you want zero vendor risk

The "login requirement" thing pissed off a lot of devs, so Serverless Inc might walk it back if adoption of v4 tanks. But you can't bank on that.

### I'm going to have Claude Code generate a "base" Lambda with TypeScript and Node

Then see if it can create me a template I can use locally to start a new Lambda project. Something I could share with the world as an easy-to-use template for Lambda development.
