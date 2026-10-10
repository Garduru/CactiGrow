# Masked, temporary production-owner preparation. No migration or deployment runs here.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

$credentialPath = Join-Path (Get-Location).Path '.wrangler\production-owner.credential.xml'
$previousOwnerValue = [Environment]::GetEnvironmentVariable('CACTIGROW_OWNER_DATABASE_URL', 'Process')
$productionOwnerSecret = $null
$productionOwnerCredential = $null
$prepared = $false
try {
  if (Test-Path -LiteralPath $credentialPath) { throw 'Existing temporary credential file.' }
  $productionOwnerSecret = Read-Host 'Paste the raw DIRECT Neon production owner PostgreSQL URL (input masked)' -AsSecureString
  $productionOwnerCredential = [System.Management.Automation.PSCredential]::new('cactigrow_owner', $productionOwnerSecret)
  $env:CACTIGROW_OWNER_DATABASE_URL = $productionOwnerCredential.GetNetworkCredential().Password
  $target = [Uri]$env:CACTIGROW_OWNER_DATABASE_URL
  $role = [Uri]::UnescapeDataString(($target.UserInfo -split ':', 2)[0])
  if ($target.Scheme -notin @('postgres', 'postgresql') -or
      $target.Host -ne 'ep-wild-pond-arf5s9do.c-4.us-west-2.aws.neon.tech' -or
      $target.AbsolutePath -ne '/cactigrow' -or
      $role -ne 'cactigrow_owner' -or
      $target.Query -notmatch '(?:\?|&)sslmode=(require|verify-ca|verify-full)(?:&|$)') {
    throw 'Wrong direct production owner target or TLS option.'
  }
  & npm.cmd run wild-genetics:rollout:production -- --check-connection
  if ($LASTEXITCODE -ne 0) { throw 'Production owner identity verification failed.' }
  New-Item -ItemType Directory -Path (Split-Path -Parent $credentialPath) -Force | Out-Null
  # Windows Export-Clixml encrypts SecureString using DPAPI for this user/machine.
  $productionOwnerCredential | Export-Clixml -LiteralPath $credentialPath
  $prepared = $true
  Write-Host 'Read-only identity check passed. Windows-user-encrypted production credential is ready in ignored .wrangler/production-owner.credential.xml.'
  Write-Host 'No migration, grant or deployment was performed. Reply ready for the agent continuation.'
} catch {
  # Never emit the underlying exception, URI, password or raw driver details.
  Write-Host 'Preparation failed. Check the raw direct Neon URL, exact production database/owner, TLS options, or an existing temporary credential file. No migration was performed.'
} finally {
  [Environment]::SetEnvironmentVariable('CACTIGROW_OWNER_DATABASE_URL', $previousOwnerValue, 'Process')
  if ($null -ne $productionOwnerSecret) { $productionOwnerSecret.Dispose() }
  Remove-Variable productionOwnerCredential, productionOwnerSecret, previousOwnerValue, target, role -ErrorAction SilentlyContinue
}
if (-not $prepared) { exit 1 }
