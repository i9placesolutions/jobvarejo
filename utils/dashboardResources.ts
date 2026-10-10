/** Publica a lista assim que ela chega; perfil e pastas não bloqueiam os cards. */
export async function loadDashboardResources<T, P>(options: {
  projects: Promise<T[]>
  profile: Promise<P | null>
  folders: Promise<unknown>
  isCurrent: () => boolean
  onProjects: (projects: T[]) => void
  onProfile: (profile: P) => void
  onProjectsReady: () => void
}): Promise<void> {
  await Promise.all([
    options.projects.catch(() => []).then(projects => {
      if (options.isCurrent()) options.onProjects(projects)
    }).finally(() => {
      if (options.isCurrent()) options.onProjectsReady()
    }),
    options.profile.catch(() => null).then(profile => {
      if (profile && options.isCurrent()) options.onProfile(profile)
    }),
    options.folders.catch(() => undefined),
  ])
}
