import type React from 'react'
import { translate } from '@/i18n/i18n'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import type { SpecflowTabId, SpecflowTabProps } from './specflow-types'

export type SpecflowTabDefinition = {
  id: SpecflowTabId
  label: string
  component: React.LazyExoticComponent<(p: SpecflowTabProps) => React.JSX.Element>
}

// Each feature owns its tab directory; this list only fixes order and lazy entry points.
// Why getters: labels must follow a runtime language switch, not the language at module load.
export const SPECFLOW_TABS: readonly SpecflowTabDefinition[] = [
  {
    id: 'specs',
    get label() {
      return translate('specflow.page.tabSpecs', 'Specs')
    },
    component: lazyWithRetry(() => import('./specs/SpecsTab'))
  },
  {
    id: 'wbs',
    get label() {
      return translate('specflow.page.tabWbs', 'WBS')
    },
    component: lazyWithRetry(() => import('./wbs/WbsTab'))
  },
  {
    id: 'erd',
    get label() {
      return translate('specflow.page.tabErd', 'ERD')
    },
    component: lazyWithRetry(() => import('./erd/ErdTab'))
  },
  {
    id: 'code-graph',
    get label() {
      return translate('specflow.page.tabCodeGraph', 'Code Graph')
    },
    component: lazyWithRetry(() => import('./code-graph/CodeGraphTab'))
  }
]
