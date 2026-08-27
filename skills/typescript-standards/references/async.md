# Async

Avoid request waterfalls. Parallelize independent work; defer `await` until
the branch that needs it.

## Parallel independent work

Use `Promise.all` when awaits do not depend on each other — sequential chains add latency for no reason.

```typescript
// ❌ Incorrect: sequential waterfalls — each step waits on the previous
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// ✅ Correct: Promise.all for independent awaits
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
])
```

## Start independent work early

When some work depends on a prior result and some does not, kick off the independent promises immediately — don't wait to finish the dependency chain first.

```typescript
// ❌ Incorrect: config waits for auth for no reason
export async function GET() {
  const session = await auth()
  const config = await fetchConfig()
  const resource = await fetchResource(session.user.id)
  return Response.json({ resource, config })
}

// ✅ Correct: auth + config start together; resource waits only on session
export async function GET() {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, resource] = await Promise.all([
    configPromise,
    fetchResource(session.user.id),
  ])

  return Response.json({ resource, config })
}
```

## Partial dependencies

When task B needs A but C is independent, start A and C together; chain B off A's promise.

```typescript
// ❌ Incorrect: profile waits for config unnecessarily
const [user, config] = await Promise.all([fetchUser(), fetchConfig()])
const profile = await fetchProfile(user.id)

// ✅ Correct: config runs while profile waits only on user
const userPromise = fetchUser()
const profilePromise = userPromise.then((user) => fetchProfile(user.id))

const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
])
```

## Defer await until needed

Await only on the code path that uses the result — don't block branches that exit early.

```typescript
// ❌ Incorrect: blocks both branches — fetch runs even when skipping
export async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)

  if (skipProcessing) {
    return { skipped: true }
  }

  return processUserData(userData)
}

// ✅ Correct: await only on the path that uses the result
export async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true }
  }

  const userData = await fetchUserData(userId)

  return processUserData(userData)
}
```

Check cheap conditions before paying for async work when a later await is only needed after a successful check.

```typescript
// ❌ Incorrect: always fetches permissions before knowing the resource exists
const permissions = await fetchPermissions(userId)
const resource = await getResource(resourceId)

if (!resource) {
  return { error: 'Not found' }
}

if (!permissions.canEdit) {
  return { error: 'Forbidden' }
}

return updateResourceData(resource, permissions)

// ✅ Correct: permissions only after resource exists — no wasted fetch on 404
const resource = await getResource(resourceId)

if (!resource) {
  return { error: 'Not found' }
}

const permissions = await fetchPermissions(userId)

if (!permissions.canEdit) {
  return { error: 'Forbidden' }
}

return updateResourceData(resource, permissions)
```

## Cheap sync conditions before async flags

Run synchronous guards before async feature-flag checks when the sync condition can short-circuit the work.

```typescript
// ❌ Incorrect: pays for async even when sync condition fails
export async function runFeature() {
  const isFeatureEnabled = await fetchIsFeatureEnabled()

  if (isFeatureEnabled && isUserEligible) {
    await applyFeature()
  }
}

// ✅ Correct: sync guard first — skip async when it can never pass
export async function runFeature() {
  if (!isUserEligible) {
    return
  }

  const isFeatureEnabled = await fetchIsFeatureEnabled()

  if (!isFeatureEnabled) {
    return
  }

  await applyFeature()
}
```

Keep original order if the sync check is expensive or depends on the feature flag.
