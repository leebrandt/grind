# The refinement of my local Gemma3:27B model

This will be a long-running project to learn how AI models work.

I will:
1. Learn how to use Gemma3 (in general). Chat with her, get to know where her edges are.
2. Learn RAG and context stuffing with Gemma
3. Build around Gemma. Agents, MCP, etc.
4. Learn LoRA\QLoRA using Gemma
5. Any other advanced AI stuff (should be a year from now at least)

I pulled Gemma3:27b locally in ollama. Have been chatting with her, and (yes, I called it "her") had her generate a base GEMMA.md file for keeping context about me and our work together. I have a feeling the *real* wake-up for Gemma will be when I start building around her (C-Suite of agents), that I will *really* see the potential.

Back at it. 02282026

## New revelation about LLMs

I just learned that the LLM is always the LLM, but your connection to it, changes the capabilites of tha model. Now that I type that out, it seems stupid not to have noticed it right off. Bit, I *am* stupid, so I'm used to dealing with it. For instance:

When chatting with Gemma3:27b (running on ollama) in the * **terminal** *, I get __VERY__ limited capabilities for the LLM. There's a 27b context window, but the only way to get things *into* that context window is by typing them into the terminal.

The conversation is also VERY sterile. It could be psychosomatic, but chats in the terminal felt more like talking to a machine than when interacting through the web ui.


When chatting with Gemma3:27b (same, exact model) through OpenWebUI, there's all kinds of things you can do to get context into the window: upload a file or image, install a plugin, use one of the free ones that come with OpenWebUI. Like web search.

 
