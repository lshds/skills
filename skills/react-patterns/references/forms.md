# Forms

Prefer controlled inputs (or the repo’s form library), `isPending` on submit,
and inline field errors from local state.

## Controlled submit flow

Match the repo’s form approach. When using controlled local state:

```tsx
// ❌ Incorrect: no pending guard / validate only as fire-and-forget
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault()
  await onSave(values)
}

// ✅ Correct: validate → pending → save — guarded submit with inline errors
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

  const handleSubmit = async (event: React.FormEvent) => {
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

## Rules

- Prefer controlled inputs, or the repo’s form library (React Hook Form, Zod, etc.) when present — don’t invent a parallel validation style in one feature.
- Guard double-submit with `isPending` (or equivalent); disable the submitting control while pending.
- On recoverable save failure, keep `values` and set an error — don’t reset the form unless the flow requires it.
- Uncontrolled + form library only when that is already the local pattern.
