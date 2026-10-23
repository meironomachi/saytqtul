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
- Private archive views use browser-client query options under the authenticated layout; why: search and reports must retain owner-only access without server logic.
- Local entry drafts are scoped by user and date, restored only when newer than the saved entry, and cleared after save or discard; why: drafts must not cross accounts or overwrite newer saved work.
- Weather is an optional entry field and analytics aggregate mood tags and activity labels separately; why: existing entries remain compatible and distinct kinds stay meaningful.
