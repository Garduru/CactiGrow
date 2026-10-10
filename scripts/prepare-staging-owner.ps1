# Masked, temporary staging-owner preparation. No migration or deployment runs here.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

$credentialPath = Join-Path (Get-Location).Path '.wrangler\staging-owner.credential.xml'
$previousOwnerValue = [Environment]::GetEnvironmentVariable('CACTIGROW_OWNER_DATABASE_URL', 'Process')
$stagingOwnerSecret = $null
$stagingOwnerCredential = $null
$prepared = $false
try {
  if (Test-Path -LiteralPath $credentialPath) { throw 'Existing temporary credential file.' }
  $stagingOwnerSecret = Read-Host 'Paste the raw DIRECT Neon staging owner PostgreSQL URL (input masked)' -AsSecureString
  $stagingOwnerCredential = [System.Management.Automation.PSCredential]::new('cactigrow_staging_owner', $stagingOwnerSecret)
  $env:CACTIGROW_OWNER_DATABASE_URL = $stagingOwnerCredential.GetNetworkCredential().Password
  $target = [Uri]$env:CACTIGROW_OWNER_DATABASE_URL
  $role = [Uri]::UnescapeDataString(($target.UserInfo -split ':', 2)[0])
  if ($target.Scheme -notin @('postgres', 'postgresql') -or
      $target.Host -ne 'ep-wild-pond-arf5s9do.c-4.us-west-2.aws.neon.tech' -or
      $target.AbsolutePath -ne '/cactigrow_staging' -or
      $role -ne 'cactigrow_staging_owner' -or
      $target.Query -notmatch '(?:\?|&)sslmode=(require|verify-ca|verify-full)(?:&|$)') {
    throw 'Wrong direct staging owner target or TLS option.'
  }
  & npm.cmd run wild-genetics:rollout -- --check-connection
  if ($LASTEXITCODE -ne 0) { throw 'Staging owner identity verification failed.' }
  New-Item -ItemType Directory -Path (Split-Path -Parent $credentialPath) -Force | Out-Null
  # Windows Export-Clixml encrypts SecureString using DPAPI for this user/machine.
  $stagingOwnerCredential | Export-Clixml -LiteralPath $credentialPath
  $prepared = $true
  Write-Host 'Read-only identity check passed. Windows-user-encrypted staging credential is ready in ignored .wrangler/staging-owner.credential.xml.'
  Write-Host 'No migration, grant or deployment was performed. Reply ready for the agent continuation.'
} catch {
  # Never emit the underlying exception, URI, password or raw driver details.
  Write-Host 'Preparation failed. Check the raw direct Neon URL, exact staging database/owner, TLS options, or an existing temporary credential file. No migration was performed.'
} finally {
  [Environment]::SetEnvironmentVariable('CACTIGROW_OWNER_DATABASE_URL', $previousOwnerValue, 'Process')
  if ($null -ne $stagingOwnerSecret) { $stagingOwnerSecret.Dispose() }
  Remove-Variable stagingOwnerCredential, stagingOwnerSecret, previousOwnerValue, target, role -ErrorAction SilentlyContinue
}
if (-not $prepared) { exit 1 }
