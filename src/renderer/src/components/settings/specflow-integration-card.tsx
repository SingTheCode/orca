import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMountedRef } from '@/hooks/useMountedRef'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { DEFAULT_SPECFLOW_SERVER_URL } from '../../../../shared/specflow-settings'
import { useSpecflowConnection } from '../specflow/use-specflow-connection'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { SPECFLOW_INTEGRATION_SECTION_ID } from './task-provider-integration-section-ids'

type ActionResult = { state: 'ok' | 'error'; message: string }

export function SpecflowIntegrationCard(): React.JSX.Element {
  const savedServerUrl = useAppStore(
    (s) => s.settings?.specflowServerUrl ?? DEFAULT_SPECFLOW_SERVER_URL
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const mountedRef = useMountedRef()
  const { connection, refresh } = useSpecflowConnection()
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'connect' | 'test' | 'disconnect' | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  const checking = connection.state === 'checking'
  const status = connection.state === 'ready' ? connection.status : null
  const connected = status?.connected === true
  const serverUrlValue = serverUrl ?? savedServerUrl

  const runAction = async (
    kind: NonNullable<typeof busy>,
    action: () => Promise<ActionResult>
  ): Promise<void> => {
    setBusy(kind)
    setResult(null)
    const outcome = await action()
    await refresh()
    if (mountedRef.current) {
      setResult(outcome)
      setBusy(null)
    }
  }

  const connect = (): Promise<void> =>
    runAction('connect', async () => {
      const response = await window.api.specflow.connect({
        serverUrl: serverUrlValue,
        email,
        password
      })
      if (!response.ok) {
        return { state: 'error', message: response.error }
      }
      // Why: the server URL setting drives other readers (MCP config, team server), so persist the one that worked.
      await updateSettings({ specflowServerUrl: serverUrlValue })
      setPassword('')
      return {
        state: 'ok',
        message: translate('specflow.settings.connectedAs', 'Connected as {{email}}', {
          email: response.data.user.email
        })
      }
    })

  const test = (): Promise<void> =>
    runAction('test', async () => {
      const response = await window.api.specflow.request({ method: 'GET', path: '/auth/me' })
      return response.ok
        ? { state: 'ok', message: translate('specflow.settings.verified', 'Verified') }
        : { state: 'error', message: response.error }
    })

  const disconnect = (): Promise<void> =>
    runAction('disconnect', async () => {
      const response = await window.api.specflow.disconnect()
      return response.ok
        ? { state: 'ok', message: translate('specflow.settings.disconnected', 'Disconnected') }
        : { state: 'error', message: response.error }
    })

  return (
    <IntegrationCardShell
      settingsSectionId={SPECFLOW_INTEGRATION_SECTION_ID}
      icon={<Workflow className="size-5" />}
      name="SpecFlow"
      description={
        connected && status
          ? `${status.email ?? ''} · ${status.serverUrl ?? ''}`
          : translate(
              'specflow.settings.description',
              'Plan specs, WBS, and ERD on a SpecFlow server and hand tasks to agents.'
            )
      }
      checking={checking}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? translate('specflow.settings.statusConnected', 'Connected')
          : translate('specflow.settings.statusNotConnected', 'Not connected')
      }
      actions={
        connected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void test()}
            >
              {busy === 'test' ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
              {translate('specflow.settings.test', 'Test')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void disconnect()}
            >
              {translate('specflow.settings.disconnect', 'Disconnect')}
            </Button>
          </>
        ) : null
      }
    >
      <IntegrationCardDetails>
        {!connected && !checking ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="specflow-server-url">
                {translate('specflow.settings.serverUrl', 'Server URL')}
              </Label>
              <Input
                id="specflow-server-url"
                value={serverUrlValue}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder={DEFAULT_SPECFLOW_SERVER_URL}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="specflow-email">
                {translate('specflow.settings.email', 'Email')}
              </Label>
              <Input
                id="specflow-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="specflow-password">
                {translate('specflow.settings.password', 'Password')}
              </Label>
              <Input
                id="specflow-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && email && password && busy === null) {
                    void connect()
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {translate(
                'specflow.settings.credentialCopy',
                'Credentials are stored locally and encrypted when the OS keychain is available.'
              )}
            </p>
            <Button
              size="sm"
              disabled={busy !== null || !serverUrlValue.trim() || !email.trim() || !password}
              onClick={() => void connect()}
            >
              {busy === 'connect' ? (
                <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              {translate('specflow.settings.connect', 'Connect SpecFlow')}
            </Button>
          </div>
        ) : null}
        {connection.state === 'error' ? (
          <p className="text-xs text-destructive">{connection.error}</p>
        ) : null}
        {result ? (
          <p
            className={cn(
              'flex items-center gap-1 text-xs',
              result.state === 'ok' ? 'text-status-success' : 'text-destructive'
            )}
          >
            {result.state === 'ok' ? (
              <CheckCircle2 className="size-3.5 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{result.message}</span>
          </p>
        ) : null}
      </IntegrationCardDetails>
    </IntegrationCardShell>
  )
}
