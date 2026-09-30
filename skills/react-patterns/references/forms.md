# Forms

Prefer controlled inputs (or the repo’s form library), `isPending` on submit,
and inline field errors from local state. Forms that post to a Server Action
use `useActionState` on React 19.

## Controlled submit flow

Match the repo’s form approach. When using controlled local state:

```tsx
// ❌ Incorrect: no pending guard / validate only as fire-and-forget
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {}

    if (!values.name.trim()) {
      nextErrors.name = 'Name is required'
    }

    return nextErrors
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validate()
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

    const result = await updateDisplayName(
      { kind: 'idle' },
      new FormData(event.currentTarget),
    )

    setIsPending(false)
    setErrorMessage(result.kind === 'error' ? result.message : undefined)
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

// display-name-form.tsx
'use client'

import { useActionState } from 'react'

import { updateDisplayName } from './actions'

export function DisplayNameForm() {
  const [result, formAction, isPending] = useActionState(updateDisplayName, {
    kind: 'idle',
  })

  return (
    <form action={formAction}>
      <input
        name="displayName"
        defaultValue={result.kind === 'error' ? result.submittedName : ''}
      />
      {result.kind === 'error' ? <p role="alert">{result.message}</p> : null}
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
- A submit button in its own component reads `pending` from `useFormStatus()`
  (`react-dom`) instead of taking a prop.
- `useFormState` from `react-dom` is the deprecated name — use `useActionState`
  from `react`.
- Keep the controlled flow above for saves that never reach a Server Action, and
  on React 18.

## Rules

- Prefer controlled inputs, or the repo’s form library (React Hook Form, Zod, etc.) when present — don’t invent a parallel validation style in one feature.
- Guard double-submit with `isPending` (or equivalent); disable the submitting control while pending.
- On recoverable save failure, keep `values` and set an error — don’t reset the form unless the flow requires it.
- Uncontrolled + form library only when that is already the local pattern.
