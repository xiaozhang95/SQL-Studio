/** Wait for each subtest callback before dependent fixture work or cleanup. */
export function step(context, name, run) {
  return new Promise((resolve, reject) => {
    context.test(name, async (child) => {
      try {
        await run(child)
        resolve()
      } catch (error) {
        reject(error)
        throw error
      }
    })
  })
}
