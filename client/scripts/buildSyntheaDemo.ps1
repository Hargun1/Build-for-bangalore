param(
  [Parameter(Mandatory = $true)][string]$Archive,
  [string]$Output = (Join-Path $PSScriptRoot '../src/data/syntheaDemo.json')
)

$ErrorActionPreference = 'Stop'
$expectedHash = '990D52064037BBF83D10F13163DA428964B56AE673B7F39BF549D78C1E7EDA16'
$hash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash
if ($hash -ne $expectedHash) { throw 'The Synthea sample archive changed. Review the new data before regenerating the demo.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Archive))
try {
  function Read-Table([string]$name) {
    $entry = $zip.Entries | Where-Object Name -eq $name | Select-Object -First 1
    if (-not $entry) { throw "Missing $name in Synthea archive" }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    try { return @($reader.ReadToEnd() | ConvertFrom-Csv) }
    finally { $reader.Dispose() }
  }

  $patients = Read-Table 'patients.csv'
  $observations = Read-Table 'observations.csv'
  $conditions = Read-Table 'conditions.csv'
  $medications = Read-Table 'medications.csv'
  $allergies = Read-Table 'allergies.csv'
  $encounters = Read-Table 'encounters.csv'
} finally { $zip.Dispose() }

function Index-ByPatient($rows) {
  $index = @{}
  foreach ($row in $rows) {
    if (-not $index.ContainsKey($row.PATIENT)) { $index[$row.PATIENT] = [System.Collections.Generic.List[object]]::new() }
    $index[$row.PATIENT].Add($row)
  }
  return $index
}

function Number-Value([string]$value) {
  $number = 0.0
  if ([double]::TryParse($value, [System.Globalization.NumberStyles]::Float,
      [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
    return [math]::Round($number, 1)
  }
  return $null
}

function Snapshot([object]$row) {
  if (-not $row) { return $null }
  $value = Number-Value $row.VALUE
  if ($null -eq $value) { return $null }
  return [ordered]@{ value = $value; unit = $row.UNITS; day = $row.DATE.Substring(0, 10) }
}

$obsByPatient = Index-ByPatient $observations
$conditionsByPatient = Index-ByPatient $conditions
$medsByPatient = Index-ByPatient $medications
$allergiesByPatient = Index-ByPatient $allergies
$encountersByPatient = Index-ByPatient $encounters
$labCodes = [ordered]@{
  '4548-4' = 'HbA1c'
  '2339-0' = 'Blood glucose'
  '2093-3' = 'Total cholesterol'
  '2085-9' = 'HDL cholesterol'
  '18262-6' = 'LDL cholesterol'
  '2160-0' = 'Creatinine'
  '718-7' = 'Hemoglobin'
}

$profiles = [System.Collections.Generic.List[object]]::new()
foreach ($person in ($patients | Sort-Object Id)) {
  if ($person.DEATHDATE) { continue }
  $id = $person.Id
  $personObs = @($obsByPatient[$id] | Sort-Object DATE -Descending)
  $visits = @($encountersByPatient[$id] | Sort-Object START -Descending)
  if (-not $visits.Count) { continue }
  $lastDay = $visits[0].START.Substring(0, 10)
  $birthday = [datetime]::ParseExact($person.BIRTHDATE, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  $atVisit = [datetime]::ParseExact($lastDay, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  $age = $atVisit.Year - $birthday.Year
  if ($atVisit -lt $birthday.AddYears($age)) { $age-- }
  if ($age -lt 18 -or $age -gt 85) { continue }

  $systolic = @($personObs | Where-Object CODE -eq '8480-6')
  $diastolic = @($personObs | Where-Object CODE -eq '8462-4')
  $bpHistory = [System.Collections.Generic.List[object]]::new()
  foreach ($top in $systolic) {
    $bottom = $diastolic | Where-Object { $_.ENCOUNTER -eq $top.ENCOUNTER -and $_.DATE -eq $top.DATE } | Select-Object -First 1
    $sys = Number-Value $top.VALUE
    $dia = Number-Value $bottom.VALUE
    if ($null -ne $sys -and $null -ne $dia) {
      $bpHistory.Add([ordered]@{ day = $top.DATE.Substring(0, 10); systolic = $sys; diastolic = $dia })
    }
    if ($bpHistory.Count -ge 6) { break }
  }
  if (-not $bpHistory.Count) { continue }

  $labs = [System.Collections.Generic.List[object]]::new()
  foreach ($code in $labCodes.Keys) {
    $row = $personObs | Where-Object CODE -eq $code | Select-Object -First 1
    $reading = Snapshot $row
    if ($reading) { $labs.Add([ordered]@{ label = $labCodes[$code]; code = $code; value = $reading.value; unit = $reading.unit; day = $reading.day }) }
  }
  if ($labs.Count -lt 2) { continue }

  $vitals = [ordered]@{ bloodPressure = @($bpHistory); weight = $null; height = $null; pulse = $null; oxygenSaturation = $null }
  foreach ($item in @(@('29463-7','weight'), @('8302-2','height'), @('8867-4','pulse'), @('2708-6','oxygenSaturation'))) {
    $row = $personObs | Where-Object CODE -eq $item[0] | Select-Object -First 1
    $vitals[$item[1]] = Snapshot $row
  }

  $profile = [ordered]@{
    id = ('Sample {0:D2}' -f ($profiles.Count + 1))
    ageAtLastVisit = $age
    sex = if ($person.GENDER -eq 'F') { 'Female' } elseif ($person.GENDER -eq 'M') { 'Male' } else { 'Unknown' }
    lastVisitDay = $lastDay
    vitals = $vitals
    labs = @($labs)
    conditions = @($conditionsByPatient[$id] | Where-Object { $_.DESCRIPTION -match '\(disorder\)$' } | Sort-Object START -Descending | Select-Object -First 8 | ForEach-Object { [ordered]@{ label = $_.DESCRIPTION; day = $_.START.Substring(0, 10) } })
    medications = @($medsByPatient[$id] | Where-Object { (-not $_.STOP) -or ($_.STOP.Substring(0, 10) -gt $lastDay) } | Sort-Object START -Descending | Select-Object -First 8 | ForEach-Object { [ordered]@{ label = $_.DESCRIPTION; since = $_.START.Substring(0, 10) } })
    allergies = @($allergiesByPatient[$id] | Where-Object { (-not $_.STOP) -or ($_.STOP.Substring(0, 10) -gt $lastDay) } | Sort-Object START -Descending | Select-Object -First 8 | ForEach-Object { [ordered]@{ label = $_.DESCRIPTION; since = $_.START.Substring(0, 10) } })
    visits = @($visits | Select-Object -First 8 | ForEach-Object { [ordered]@{ day = $_.START.Substring(0, 10); type = $_.ENCOUNTERCLASS; reason = if ($_.REASONDESCRIPTION) { $_.REASONDESCRIPTION } else { $_.DESCRIPTION } } })
  }
  $profiles.Add($profile)
  if ($profiles.Count -ge 50) { break }
}

if ($profiles.Count -lt 20) { throw "Only $($profiles.Count) complete adult sample profiles found; review the source archive." }
$out = [ordered]@{ source = 'Synthea 100-sample CSV archive'; profiles = @($profiles) }
$json = $out | ConvertTo-Json -Depth 12 -Compress
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($Output), $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($profiles.Count) synthetic patient profiles to $Output"
