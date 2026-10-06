# Forms

Prefer controlled inputs (or the repo’s form library), `isPending` on submit,
and inline field errors from local state. Forms that post to a Server Action
use `useActionState` on React 19, read pending state with `useFormStatus` in a
child of the `<form>`, and show instant feedback with `useOptimistic`.

## Controlled submit flow

Match the repo’s form approach. When using controlled local state:

```tsx
// ❌ Incorrect: no pending guard / validate only as fire-and-forget
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  await onSave(values)
}

// ✅ Correct: validate → pending → save — guarded submit with inline errors
import { useState } from 'react'

interface FormValues {
  name: string
}

interface FormErrors {
  name?: string
}

interface RenameFormProps {
  onSave: (values: FormValues) => Promise<void>
}

export function RenameForm({ onSave }: RenameFormProps) {
  const [values, setValues] = useState<FormValues>({ name: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isPending, setIsPending] = useState(false)

  const validateValues = (): FormErrors => {
    const nextErrors: FormErrors = {}

    if (!values.name.trim()) {
      nextErrors.name = 'Name is required'
    }

    return nextErrors
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validateValues()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsPending(true)

    try {
      await onSave(values)
    } catch {
      // keep `values`; surface a submit error if the UI has one
    } finally {
      setIsPending(false)
    }
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((currentValues) => ({
      ...currentValues,
      name: event.target.value,
    }))
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={values.name}
        onChange={handleNameChange}
        disabled={isPending}
      />
      {errors.name ? <span>{errors.name}</span> : null}
      <button type="submit" disabled={isPending}>
        Save
      </button>
    </form>
  )
}
```

## Server Action forms (React 19)

When the form posts to a Server Action, hand-rolled `isPending` / error state
duplicates what `useActionState` already tracks, and an `onSubmit` handler
means the form does nothing until JavaScript has loaded.

```tsx
// ❌ Incorrect: hand-rolled pending and error state around a Server Action
'use client'

import { useState } from 'react'

import { updateDisplayName } from './actions'

export function DisplayNameForm() {
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsPending(true)

    const updateResult = await updateDisplayName(
      { kind: 'idle' },
      new FormData(event.currentTarget),
    )

    setIsPending(false)
    setErrorMessage(
      updateResult.kind === 'error' ? updateResult.message : undefined,
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="displayName" />
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={isPending}>
        Save
      </button>
    </form>
  )
}

// ✅ Correct: useActionState owns the result and pending state; the form posts to the action
// actions.ts
'use server'

export type UpdateDisplayNameResult =
  | { kind: 'idle' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string; submittedName: string }

export async function updateDisplayName(
  previousResult: UpdateDisplayNameResult,
  formData: FormData,
): Promise<UpdateDisplayNameResult> {
  const session = await requireSession()
  const displayName = readDisplayNameFromForm(formData)

  if (!displayName) {
    return { kind: 'error', message: 'Name is required', submittedName: '' }
  }

  const isSaved = await saveDisplayName(session.userId, displayName)

  if (!isSaved) {
    return {
      kind: 'error',
      message: 'Could not save the name',
      submittedName: displayName,
    }
  }

  return { kind: 'ok' }
}

function readDisplayNameFromForm(formData: FormData) {
  const displayName = formData.get('displayName')

  if (typeof displayName !== 'string') {
    return
  }

  const trimmedName = displayName.trim()

  if (!trimmedName) {
    return
  }

  return trimmedName
}

// DisplayNameForm.tsx
'use client'

import { useActionState } from 'react'

import { updateDisplayName } from './actions'

export function DisplayNameForm() {
  const [updateResult, formAction, isPending] = useActionState(
    updateDisplayName,
    { kind: 'idle' },
  )

  return (
    <form action={formAction}>
      <input
        name="displayName"
        defaultValue={
          updateResult.kind === 'error' ? updateResult.submittedName : ''
        }
      />
      {updateResult.kind === 'error' ? (
        <p role="alert">{updateResult.message}</p>
      ) : null}
      <button type="submit" disabled={isPending}>
        Save
      </button>
    </form>
  )
}
```

- The action reads the session itself — a Server Action is a public POST
  endpoint that any client can call with any form data, whatever the UI hides.
- React resets uncontrolled fields after a form action. Return the submitted
  values on a recoverable error and feed them back as `defaultValue` so the
  user’s input survives.
- `useFormState` from `react-dom` is the deprecated name — use `useActionState`
  from `react`.
- Keep the controlled flow above for saves that never reach a Server Action, and
  on React 18.

## Pending state from `useFormStatus` in a child

`useFormStatus` (`react-dom`) reads the status of the parent `<form>`. Called
in the component that renders the form, there is no parent form, so `pending`
stays `false` and the button never disables.

```tsx
// ❌ Incorrect: useFormStatus in the component that renders the <form> — pending is always false
'use client'

import { useFormStatus } from 'react-dom'

import { subscribeToNewsletter } from './actions'

export function NewsletterForm() {
  const { pending: isPending } = useFormStatus()

  return (
    <form action={subscribeToNewsletter}>
      <input name="email" type="email" />
      <button type="submit" disabled={isPending}>
        Subscribe
      </button>
    </form>
  )
}

// ✅ Correct: the submit button is its own component rendered inside the <form>
'use client'

import { useFormStatus } from 'react-dom'

import { subscribeToNewsletter } from './actions'

function SubscribeButton() {
  const { pending: isPending } = useFormStatus()

  return (
    <button type="submit" disabled={isPending}>
      {isPending ? 'Subscribing…' : 'Subscribe'}
    </button>
  )
}

export function NewsletterForm() {
  return (
    <form action={subscribeToNewsletter}>
      <input name="email" type="email" />
      <SubscribeButton />
    </form>
  )
}
```

- The child reads the status itself — don’t thread `isPending` down as a prop
  when the button already sits inside the form.

## Instant feedback with `useOptimistic`

Waiting for the server round trip before showing the result makes a posted
comment look lost. `useOptimistic` renders the expected result while the
Action runs and falls back to the real data when it settles.

```tsx
// ❌ Incorrect: the list renders only `comments` — the new comment appears after the round trip
const submitComment = async (formData: FormData) => {
  const body = readCommentBody(formData)

  if (!body) {
    return
  }

  await addComment(postId, body)
}

// ✅ Correct: the comment shows at once, marked as sending, while the Action runs
'use client'

import { useOptimistic } from 'react'

import { addComment } from './actions'

interface ThreadComment {
  id: string
  body: string
  isSending?: boolean
}

interface CommentThreadProps {
  postId: string
  comments: ThreadComment[]
}

function readCommentBody(formData: FormData) {
  const body = formData.get('body')

  if (typeof body !== 'string') {
    return
  }

  return body.trim()
}

export function CommentThread({ postId, comments }: CommentThreadProps) {
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (currentComments: ThreadComment[], newComment: ThreadComment) => [
      ...currentComments,
      newComment,
    ],
  )

  const submitComment = async (formData: FormData) => {
    const body = readCommentBody(formData)

    if (!body) {
      return
    }

    addOptimisticComment({ id: crypto.randomUUID(), body, isSending: true })
    await addComment(postId, body)
  }

  return (
    <>
      <ul>
        {optimisticComments.map((comment) => (
          <li key={comment.id}>
            {comment.body}
            {comment.isSending ? <small> Sending…</small> : null}
          </li>
        ))}
      </ul>
      <form action={submitComment}>
        <textarea name="body" />
        <button type="submit">Post</button>
      </form>
    </>
  )
}
```

- Call the optimistic setter inside an Action — a function passed to
  `<form action>`, or a `startTransition` callback; React warns about
  optimistic updates outside one.
- The optimistic value lasts only while the Action is pending. When it settles,
  React renders `comments` again, so the saved comment must arrive through
  refreshed data (however the app refreshes server data) or it disappears.
- If the Action fails, the optimistic entry disappears on its own — show an
  error so the user knows the comment wasn’t posted.

## Rules

- Prefer controlled inputs, or the repo’s form library and its schema validator when present (for example React Hook Form with Zod) — don’t invent a parallel validation style in one feature.
- Guard double-submit with `isPending` (or equivalent); disable the submitting control while pending.
- On recoverable save failure, keep `values` and set an error — don’t reset the form unless the flow requires it.
- Uncontrolled + form library only when that is already the local pattern.
