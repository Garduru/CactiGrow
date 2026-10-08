import type { FieldSurveyProjectionV1 } from '../../../shared/api/fieldSurveyV1.ts'

export function fieldSurveyObjectives(projection: FieldSurveyProjectionV1) {
  const objectives = projection.objectives
  const landmarks = objectives.landmarks.filter(record => record.discoveredAt).length
  return [
    { id: 'landmarks', label: 'Basin landmarks', detail: `${landmarks} / 3`, complete: landmarks >= 3 },
    { id: 'san-pedro', label: 'Wild San Pedro', complete: objectives.sanPedroHarvested },
    { id: 'peyote', label: 'Wild Peyote', complete: objectives.peyoteHarvested },
    { id: 'cave', label: 'Basin Cave', complete: objectives.caveEntered },
    { id: 'cave-content', label: 'Cave landmark & field note', complete: objectives.caveLandmarkDiscovered && objectives.caveNoteInspected },
    { id: 'report', label: 'Report to Mara at Cross Path', complete: projection.status === 'complete' },
  ]
}

export function fieldSurveyHint(projection: FieldSurveyProjectionV1) {
  if (projection.status === 'complete') return 'Survey recorded. Keep exploring at your own pace.'
  if (projection.status === 'available') return 'Mara has an optional survey at Cross Path.'
  if (projection.status === 'ready-to-report') return 'Return to Mara at Cross Path with your findings.'
  if (!projection.objectives.peyoteHarvested) return 'Explore the deeper Basin trails. Wild Peyote favors harsher ground.'
  if (!projection.objectives.caveEntered || !projection.objectives.caveLandmarkDiscovered || !projection.objectives.caveNoteInspected) return 'Search the Basin Cave and inspect its mineral formation.'
  return 'Follow the Basin from its sheltered western grove, across the dry wash, toward the eastern rise.'
}
