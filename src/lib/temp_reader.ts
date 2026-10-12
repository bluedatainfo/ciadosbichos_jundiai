import pb from '@/lib/pocketbase/client'

export async function readDiagFromProgress() {
  const record = await pb
    .collection('import_progress')
    .getFirstListItem('file_name = "DIAGNOSTICO_TAREFAS_2_E_3"')
  return record.summary
}
