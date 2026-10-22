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

- Diary data (entries, comments, profiles) is read/written from the browser client with owner-only RLS; why: single-user private diary needs no server logic.
- Signup approval: profiles.approved is changed only via approve_user() (admin via user_roles); diary RLS requires is_approved(); first account becomes admin; why: users must not self-approve.
