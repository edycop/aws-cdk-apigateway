import cdk = require("@aws-cdk/core");
import apigateway = require("@aws-cdk/aws-apigateway");
import lambda = require("@aws-cdk/aws-lambda");
import dynamodb = require("@aws-cdk/aws-dynamodb");
import iam = require("@aws-cdk/aws-iam");

export class CdkApiExampleStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // TABLE TO SAVE DATA
    const eventsTable = new dynamodb.Table(this, "events-table", {
      tableName: "events",
      partitionKey: {
        // primary key
        name: "name",
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        // secondary key
        name: "date",
        type: dynamodb.AttributeType.STRING
      },

      // billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
      // the new table, and it will remain in your account until manually deleted. By setting the policy to
      // DESTROY, cdk destroy will delete the table (even if it has data in it)
      removalPolicy: cdk.RemovalPolicy.DESTROY // NOT recommended for production code
    });

    // THIS IS ANOTHER WAY TO ADD FIELDS TO THE DYNAMO TABLE BECAUSE THERE IS A PROBLEM
    // WITH THE FORMER WAY IS THAT IN A QUERY TABLE WE NEED THE TWO FIELDS TO DO IT.
    // https://stackoverflow.com/questions/42757872/the-provided-key-element-does-not-match-the-schema-error-when-getting-an-item
    // const cnfEventsTable = eventsTable.node.defaultChild as dynamodb.CfnTable;
    // cnfEventsTable.attributeDefinitions = [
    //   {
    //     attributeName: "date",
    //     attributeType: dynamodb.AttributeType.STRING
    //   }
    // ];

    // LAMBDA FUNCTION TO GET ALL events
    const getAllLambdaFunction = new lambda.Function(
      this,
      "getAllLambdaFunction",
      {
        functionName: "getAllProdevLambda",
        runtime: lambda.Runtime.PYTHON_3_6,
        code: lambda.Code.asset("resources"), // Upload Python code to the AWS lambda
        // handler: "hello.handler", // From Python code defined as a handler function
        handler: "app.lambda_handler", // From Python code defined as a handler function
        memorySize: 128,
        environment: {
          REQUEST_TABLE: eventsTable.tableName
        },
        description:
          "Request handler to getall request into DynamoDB. Triggered by API Gateway."
      }
    );

    // Grant permissions over 'events' table
    getAllLambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
        resources: [eventsTable.tableArn]
      })
    );

    // APIGATEWAY
    const apiRest = new apigateway.LambdaRestApi(this, "apiRest", {
      proxy: false,
      handler: getAllLambdaFunction,
      restApiName: "ProdevAPI",
      description: "Prodev REST API"
    });

    const cfnApiRest = apiRest.node.defaultChild as apigateway.CfnRestApi;
    cfnApiRest.endpointConfiguration = {
      types: ["REGIONAL"] // To access from outside of the region
    };
    cfnApiRest.apiKeySourceType = "HEADER";

    // Add a resource: events
    const eventsApiResource = apiRest.root.addResource("events");

    const badRequestResponse: apigateway.IntegrationResponse = {
      statusCode: "400"
    };
    const internalServerResponse: apigateway.IntegrationResponse = {
      statusCode: "500"
    };
    const okResponse: apigateway.IntegrationResponse = { statusCode: "200" };

    // const getAllIntegration = new apigateway.LambdaIntegration(lambda_function);
    // events.addMethod("GET", getAllIntegration);

    // Integrate API Gateway and Lambda function
    const getRootAllIntegration = new apigateway.LambdaIntegration(
      getAllLambdaFunction,
      {
        integrationResponses: [
          badRequestResponse,
          internalServerResponse,
          okResponse
        ]
      }
    );

    // Add "GET" method for 'events' resource
    eventsApiResource.addMethod("GET", getRootAllIntegration);

    // Add "POST" method for 'events' resource
    eventsApiResource.addMethod("POST", getRootAllIntegration);

    // Add "GET" method for root endpoint
    // api_rest.root.addMethod("GET", getRootAllIntegration);

    // Add a resource: events
    // const events = api_rest.root.addResource("events");
    // const getAllIntegration = new apigateway.LambdaIntegration(lambda_function);
    // events.addMethod("GET", getAllIntegration);
    // events.addMethod("OPTIONS", getAllIntegration);
    // addCorsOptions(events); // Add CORS options to resource

    // Add "dev" stage
    // const apigateway_deploy = new apigateway.Deployment(
    //   this,
    //   "apigateway_deploy",
    //   {
    //     api: api_rest.deploymentStage.restApi,
    //     description: "Automatically created by the RestApi construct"
    //   }
    // );

    // const stage_dev = new apigateway.Stage(this, "devstage", {
    //   description: "Development stage",
    //   stageName: "dev",
    //   deployment: apigateway_deploy
    // });
  }
}

// Take it from https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/api-cors-lambda-crud-dynamodb/index.ts
export function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'"
          }
        }
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}'
      }
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true
          }
        }
      ]
    }
  );
}
