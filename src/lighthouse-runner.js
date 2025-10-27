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
    subnetID: process.env.AWS_SUBNET_ID_US_EAST_1,
  },
  'eu-central-1': {
    clusterName: process.env.ECS_CLUSTER_NAME_EU_CENTRAL_1,
    taskDefinition: process.env.ECS_TASK_DEFINITION_EU_CENTRAL_1,
    subnetID: process.env.AWS_SUBNET_ID_EU_CENTRAL_1,
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
        {
          capacityProvider: 'FARGATE_SPOT', // use Spot
          weight: 1,
          base: 0
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [REGION_CONFIGS[region].subnetID],
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
