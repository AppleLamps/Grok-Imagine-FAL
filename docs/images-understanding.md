#### Model Capabilities

# Image Understanding

When sending images, it is advised to not store request/response history on the server. Otherwise the request may fail.
See .

Some models allow images in the input. The model will consider the image context when generating the response.

## Constructing the message body - difference from text-only prompt

The request message to image understanding is similar to text-only prompt. The main difference is that instead of text input:

```json
[
  {
    "role": "user",
    "content": "What is in this image?"
  }
]
```

We send in `content` as a list of objects:

```json
[
  {
    "role": "user",
    "content": [
      {
        "type": "input_image",
        "image_url": "data:image/jpeg;base64,<base64_image_string>",
        "detail": "high"
      },
      {
        "type": "input_text",
        "text": "What is in this image?"
      }
    ]
  }
]
```

The `image_url.url` can also be the image's url on the Internet.

### Image understanding example

### Image input general limits

* Maximum image size: `20MiB`
* Maximum number of images: No limit
* Supported image file types: `jpg/jpeg` or `png`.
* Any image/text input order is accepted (e.g. text prompt can precede image prompt)

### Image detail levels

The `"detail"` field controls the level of pre-processing applied to the image that will be provided to the model. It is optional and determines the resolution at which the image is processed. The possible values for `"detail"` are:

* **`"auto"`**: The system will automatically determine the image resolution to use. This is the default setting, balancing speed and detail based on the model's assessment.
* **`"low"`**: The system will process a low-resolution version of the image. This option is faster and consumes fewer tokens, making it more cost-effective, though it may miss finer details.
* **`"high"`**: The system will process a high-resolution version of the image. This option is slower and more expensive in terms of token usage, but it allows the model to attend to more nuanced details in the image.
