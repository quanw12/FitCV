export interface SkillFrequency {
  skill: string
  count: number
  percentage: number
}

export interface JdLibraryItem {
  jobDescriptionId: number
  title: string
  sourceType: string
  rawText: string
  createdAt: string
  parseStatus: string
  requiredSkills: string[]
  preferredSkills: string[]
  softSkills: string[]
  experienceYears: number | null
  education: string | null
  matchCount: number
  latestScore: number | null
  latestMatchLabel: string | null
}

export interface JdLibraryInsights {
  totalJobDescriptions: number
  totalMatches: number
  averageMatchScore: number | null
  requiredSkills: SkillFrequency[]
  preferredSkills: SkillFrequency[]
  missingSkills: SkillFrequency[]
}
