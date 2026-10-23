<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- AI outage-advice calls go through Lovable AI Gateway from a server function: client-safe `src/lib/ai.functions.ts` (createServerFn) calls server-only `src/lib/ai.server.ts` (streamText on `@ai-sdk/openai` .responses, `openai/gpt-6-astra`, LOVABLE_API_KEY read inside the handler). Never import `.server.ts` from client code and never expose the key to the browser.

