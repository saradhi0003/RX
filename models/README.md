# Local SLM

Not committed. `./scripts/download-slm.sh` places the GGUF and llama-server here.
`./scripts/serve-slm.sh` serves it at http://127.0.0.1:1234/v1.

The phone and the Vercel app reach it only through the tunnel script. On the
same computer, the browser can call localhost directly.
