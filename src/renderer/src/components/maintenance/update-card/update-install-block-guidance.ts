import { translate } from '@/i18n/i18n'
import type { UpdateInstallBlock } from '../../../../../shared/update-status-types'

export function getUpdateInstallBlockGuidance(block: UpdateInstallBlock): {
  title: string
  summary: string
  explainer: string
} {
  if (block.reason === 'busy') {
    return {
      title: translate('updates.installBlock.busyTitle', 'Another Oh My DevX is updating'),
      summary: translate(
        'updates.installBlock.busySummary',
        'An update is already being installed by another Oh My DevX instance.'
      ),
      explainer: translate(
        'updates.installBlock.busyGuidance',
        'Wait a moment, then retry. Your downloaded update is ready.'
      )
    }
  }
  if (block.reason === 'unresponsive') {
    return {
      title: translate('updates.installBlock.unresponsiveTitle', 'Waiting for background servers'),
      summary: translate(
        'updates.installBlock.unresponsiveSummary',
        'Oh My DevX could not finish pausing its background servers for the update.'
      ),
      explainer: translate(
        'updates.installBlock.unresponsiveGuidance',
        'Stop it from the terminal or service that started it, then retry. Connected devices will disconnect.'
      )
    }
  }
  const hasServers = block.instances.some(({ kind }) => kind === 'server' || kind === 'browser')
  const onlyServers =
    block.instances.length > 0 &&
    block.instances.every(({ kind }) => kind === 'server' || kind === 'browser')
  return {
    title: translate('updates.installBlock.readyTitle', 'Your update is ready'),
    summary: onlyServers
      ? translate(
          'updates.installBlock.serverSummary',
          'A background Oh My DevX server is still using this app.'
        )
      : translate(
          'updates.installBlock.instanceSummary',
          'Another Oh My DevX instance is still using this app.'
        ),
    explainer: onlyServers
      ? translate(
          'updates.installBlock.serverGuidance',
          'Stop the server from the terminal or service that started it, then retry. Connected devices will disconnect.'
        )
      : hasServers
        ? translate(
            'updates.installBlock.mixedGuidance',
            'Close any other Oh My DevX windows and stop the server from the terminal or service that started it. Connected devices will disconnect. Then retry.'
          )
        : translate(
            'updates.installBlock.instanceGuidance',
            'Quit other Oh My DevX instances, then retry. Your downloaded update will be kept ready.'
          )
  }
}
