import { useEffect } from 'react'
import type { CategoryStepProps } from '../../appointment-booking/types'
import { LashesRegistrationFlow } from './LashesRegistrationFlow'

import { readLashesRegistrationStep } from '../lashesRegistrationFlow'

export function LashesDetailsStep(props: CategoryStepProps) {
  const registrationStep = readLashesRegistrationStep(props.details)

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [registrationStep])

  return <LashesRegistrationFlow {...props} />
}
