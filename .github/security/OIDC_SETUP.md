# OIDC Authentication Setup Guide

## Overview

This guide explains how to configure OpenID Connect (OIDC) authentication for the X/Twitter Automation Platform to eliminate static secrets and enable secure cloud deployments.

## Supported Cloud Providers

### 1. AWS OIDC Configuration

#### Step 1: Create OIDC Identity Provider in AWS
```bash
# Using AWS CLI
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### Step 2: Create IAM Role for GitHub Actions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT-ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:YOUR-ORG/YOUR-REPO:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### Step 3: GitHub Repository Secrets
```bash
# Add these secrets to your GitHub repository
AWS_ROLE_TO_ASSUME=arn:aws:iam::ACCOUNT-ID:role/GitHubActions-Role
AWS_REGION=us-east-1
```

### 2. Azure OIDC Configuration

#### Step 1: Create Azure AD Application
```bash
# Using Azure CLI
az ad app create --display-name "GitHub Actions OIDC"
az ad sp create --id <APPLICATION-ID>
```

#### Step 2: Configure Federated Credentials
```bash
az ad app federated-credential create \
  --id <APPLICATION-ID> \
  --parameters '{
    "name": "GitHubActions",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:YOUR-ORG/YOUR-REPO:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

#### Step 3: GitHub Repository Secrets
```bash
AZURE_CLIENT_ID=<APPLICATION-ID>
AZURE_TENANT_ID=<TENANT-ID>
AZURE_SUBSCRIPTION_ID=<SUBSCRIPTION-ID>
```

### 3. Google Cloud OIDC Configuration

#### Step 1: Create Workload Identity Pool
```bash
gcloud iam workload-identity-pools create "github-actions" \
  --project="PROJECT-ID" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

#### Step 2: Create Workload Identity Provider
```bash
gcloud iam workload-identity-pools providers create-oidc "github-actions-provider" \
  --project="PROJECT-ID" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

#### Step 3: GitHub Repository Secrets
```bash
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT-NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github-actions-provider
GCP_SERVICE_ACCOUNT=github-actions@PROJECT-ID.iam.gserviceaccount.com
```

## Free Hosting Services OIDC

### 1. Vercel OIDC Integration
```yaml
# In your workflow
- name: Deploy to Vercel with OIDC
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Railway OIDC Integration
```yaml
# In your workflow
- name: Deploy to Railway with OIDC
  run: |
    curl -X POST "https://backboard.railway.app/graphql/v2" \
      -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{"query": "mutation { deploymentCreate(input: { projectId: \"${{ secrets.RAILWAY_PROJECT_ID }}\", environmentId: \"${{ secrets.RAILWAY_ENVIRONMENT_ID }}\" }) { id } }"}'
```

## Workflow Integration Examples

### AWS Deployment with OIDC
```yaml
jobs:
  deploy-aws:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          role-session-name: GitHubActions
          aws-region: ${{ secrets.AWS_REGION }}
          
      - name: Deploy to AWS
        run: |
          aws s3 sync ./dist s3://${{ secrets.S3_BUCKET }}
```

### Azure Deployment with OIDC
```yaml
jobs:
  deploy-azure:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          
      - name: Deploy to Azure
        run: |
          az webapp deployment source config-zip \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --name ${{ secrets.AZURE_APP_NAME }} \
            --src ./dist.zip
```

### Google Cloud Deployment with OIDC
```yaml
jobs:
  deploy-gcp:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
          
      - name: Deploy to Google Cloud
        run: |
          gcloud app deploy app.yaml --quiet
```

## Security Best Practices

### 1. Principle of Least Privilege
- Grant minimal permissions required for deployment
- Use environment-specific roles
- Regularly audit and rotate credentials

### 2. Branch Protection
- Restrict OIDC authentication to specific branches
- Require pull request reviews for main branch
- Enable branch protection rules

### 3. Monitoring and Auditing
- Enable CloudTrail/Activity Logs for all cloud providers
- Monitor OIDC token usage
- Set up alerts for unusual authentication patterns

### 4. Token Validation
```yaml
# Validate OIDC token claims
- name: Validate Token Claims
  run: |
    echo "Repository: ${{ github.repository }}"
    echo "Ref: ${{ github.ref }}"
    echo "Actor: ${{ github.actor }}"
    echo "Event: ${{ github.event_name }}"
```

## Troubleshooting

### Common Issues

1. **Token Validation Failed**
   - Check subject claim format
   - Verify audience configuration
   - Ensure correct repository path

2. **Permission Denied**
   - Verify IAM role permissions
   - Check trust policy configuration
   - Validate resource access

3. **Provider Not Found**
   - Confirm OIDC provider creation
   - Check provider URL and thumbprint
   - Verify client ID configuration

### Debug Commands
```yaml
- name: Debug OIDC Token
  run: |
    echo "OIDC Token Claims:"
    echo "iss: ${{ github.token }}"
    echo "sub: repo:${{ github.repository }}:ref:${{ github.ref }}"
    echo "aud: sts.amazonaws.com"
```

## Migration from Static Secrets

### Step 1: Audit Current Secrets
```bash
# List current repository secrets
gh secret list --repo YOUR-ORG/YOUR-REPO
```

### Step 2: Implement OIDC Gradually
1. Set up OIDC for non-production environments first
2. Test thoroughly with staging deployments
3. Migrate production after validation
4. Remove static secrets after successful migration

### Step 3: Update Documentation
- Update deployment guides
- Train team on OIDC workflows
- Document rollback procedures

This OIDC setup eliminates the need for long-lived static secrets and provides enhanced security for your X/Twitter automation platform deployments.
