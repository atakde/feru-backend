const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');

// Default configuration
const DEFAULT_MEMORY = 2048;
const DEFAULT_CPU = 1024;
const DEFAULT_REGION = 'us-east-1';
const CONTAINER_NAME = 'l';

const REGION_CONFIGS = {
  'us-east-1': {
    clusterName: process.env.ECS_CLUSTER_NAME_US_EAST_1,
    taskDefinition: process.env.ECS_TASK_DEFINITION_US_EAST_1,
    subnetIDs: process.env.AWS_SUBNET_IDS_US_EAST_1.split(','),
  },
  'eu-central-1': {
    clusterName: process.env.ECS_CLUSTER_NAME_EU_CENTRAL_1,
    taskDefinition: process.env.ECS_TASK_DEFINITION_EU_CENTRAL_1,
    subnetIDs: process.env.AWS_SUBNET_IDS_EU_CENTRAL_1.split(','),
  },
};

async function run({ resultID, url, region = DEFAULT_REGION, memory = DEFAULT_MEMORY, cpu = DEFAULT_CPU, device }) {
  try {
    if (!resultID) {
      throw new Error('Result ID is required');
    }

    if (!device || (device !== 'desktop' && device !== 'mobile')) {
      throw new Error('Device is required');
    }

    if (!url) {
      throw new Error('URL is required');
    }

    if (!REGION_CONFIGS[region]) {
      throw new Error(`Invalid region: ${region}`);
    }

    const ecsClient = new ECSClient({
      signatureVersion: 'v4',
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new RunTaskCommand({
      cluster: REGION_CONFIGS[region].clusterName,
      taskDefinition: REGION_CONFIGS[region].taskDefinition,
      capacityProviderStrategy: [
        { capacityProvider: 'FARGATE_SPOT', weight: 1 },
        { capacityProvider: 'FARGATE', weight: 1 }
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: REGION_CONFIGS[region].subnetIDs,
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: CONTAINER_NAME,
            environment: [
              {
                name: 'URL',
                value: url,
              },
              {
                name: 'AWS_REGION',
                value: region,
              },
              {
                name: 'RESULT_ID',
                value: resultID,
              },
              {
                name: 'DEVICE',
                value: device,
              },
            ],
            memory,
            cpu,
          },
        ],
      },
    });

    const response = await ecsClient.send(command);
    console.log('ECS RunTask response:', response);
    const failures = response.failures || [];
    if (failures.length > 0) {
      const failureMessages = failures.map(f => f.reason).join('; ');
      throw new Error(`Failed to run ECS task: ${failureMessages}`);
    }

    return {
      success: true,
      message: 'Lighthouse analysis started',
      taskArn: response.tasks[0].taskArn,
      region,
      memory,
      cpu,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: error.message || 'An error occurred while starting the Lighthouse analysis',
    };
  }
}

module.exports = { run };
