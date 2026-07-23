import type { ServiceCategory } from '../../../types/api'
import type { CategoryStepProps } from './types'
import { LashesDetailsStep } from '../lashes-booking/components/LashesDetailsStep'
import { NailsDetailsStep } from './categories/nails/NailsDetailsStep'
import { CosmetologyDetailsStep } from './categories/cosmetology/CosmetologyDetailsStep'
import { MicropigmentationDetailsStep } from './categories/micropigmentation/MicropigmentationDetailsStep'

export function CategoryServiceStep(props: CategoryStepProps & { category: ServiceCategory }) {
  switch (props.category.code) {
    case 'nails':
      return <NailsDetailsStep {...props} />
    case 'lashes':
      return <LashesDetailsStep {...props} />
    case 'cosmetology':
      return <CosmetologyDetailsStep {...props} />
    case 'micropigmentation':
      return <MicropigmentationDetailsStep {...props} />
    default:
      return (
        <div className="mx-auto max-w-[393px] px-5 py-8 text-center text-sm text-[#667085]">
          Service details for {props.category.name} are not available yet.
        </div>
      )
  }
}

export function usesCategoryStepLayout(categoryCode: string) {
  return ['nails', 'lashes', 'cosmetology', 'micropigmentation'].includes(categoryCode)
}
