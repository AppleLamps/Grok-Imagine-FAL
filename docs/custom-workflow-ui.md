> ## Documentation Index
>
> Fetch the complete documentation index at: <https://docs.fal.ai/llms.txt>
> Use this file to discover all available pages before exploring further.

# Custom Workflow UI Tutorial

## How to create a custom workflow UI

If you want to create your custom workflow and execute it using the fal API, you need to create a json object that describes the workflow. You can use the following template to create your custom workflow. Basically, a workflow definition must have an input node, a fal model node, and an output node. The input node is the request to the fal API. The fal model node is the model that you want to use. You can add as many fal model nodes as you want. The output node is the response from the fal API.

```json  theme={null}
{
  // Input node / Request
  "input": {
    "id": "input",
    "type": "input",
    "depends": [],
    "input": {
      "prompt": ""
    }
  },

  // A fal model node
  "node_1": {
    "id": "node_1",
    "type": "run",
    "depends": ["input"],
    // The app is the model endpoint id
    "app": "fal-ai/flux/dev",
    "input": {
      // The prompt value is coming from the Input node
      "prompt": "$input.prompt"
    }
  },

  // Another fal model node
  "node_2": {
    "id": "node_2",
    "type": "run",
    "depends": ["node_1"],
    // The app is the model endpoint id
    "app": "fal-ai/bria/background/remove",
    "input": {
      // The image_url value is coming from the "node_1" node
      "image_url": "$node_1.images.0.url"
    }
  },

  // Output node / Response
  "output": {
    "id": "output",
    "type": "display",
    "depends": ["node_2"],
    "fields": {
      "image": "$node_2.image"
    }
  }
}
```

## How to find model input and output fields

Every fal model has input and output fields. You can find the input and output fields using the following URL:

```bash  theme={null}
https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=[endpoint_id]
```

For example:

```bash  theme={null}
https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/flux/dev
```

## How to execute a custom workflow

You can execute a custom workflow using `workflows/execute` endpoint.

```js  theme={null}
const stream = await fal.stream(`workflows/execute`, {
    input: {
        // The input to the workflow
        input: {
            prompt: "A beautiful sunset over a calm ocean"
        },
        // The workflow definition
        workflow: {
          "input": {
            "id": "input",
            "type": "input",
            "depends": [],
            "input": {
              "prompt": ""
            }
          },
          "node_1": {
            "id": "node_1",
            "type": "run",
            "depends": ["input"],
            "app": "fal-ai/flux/dev",
            "input": {
              "prompt": "$input.prompt"
            }
          },
          "node_2": {
            "id": "node_2",
            "type": "run",
            "depends": ["node_1"],
            "app": "fal-ai/bria/background/remove",
            "input": {
              "image_url": "$node_1.images.0.url"
            }
          },
          "output": {
            "id": "output",
            "type": "display",
            "depends": ["node_2"],
            "fields": {
              "image": "$node_2.image"
            }
          }
        },
    },
});

stream.on("data", (event) => {
  console.log(event);
});

const result = await stream.done();
```
