# AI SDK Integration

Server side
- Use the Vercel AI SDK streamText with a model.
- Build a system prompt from the catalog using generateCatalogPrompt.
- Optionally include the current UITree in the prompt for edits.
- Stream JSONL patch operations back to the client.

Client side
- Use useUIStream with the streaming endpoint.
- Pass the resulting UITree to Renderer.

Tips
- Keep prompts deterministic and aligned with your catalog descriptions.
- Validate that streamed patches produce valid UI trees.
