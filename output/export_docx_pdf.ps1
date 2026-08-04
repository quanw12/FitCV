param(
    [Parameter(Mandatory = $true)]
    [string]$InputDocx,
    [Parameter(Mandatory = $true)]
    [string]$OutputPdf,
    [switch]$UpdateFields,
    [switch]$SaveDocument
)

$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $readOnly = -not $SaveDocument
    $document = $word.Documents.Open($InputDocx, $false, $readOnly)
    if ($UpdateFields) {
        foreach ($toc in $document.TablesOfContents) {
            $toc.Update()
        }
        $document.Fields.Update() | Out-Null
        foreach ($section in $document.Sections) {
            foreach ($header in $section.Headers) {
                $header.Range.Fields.Update() | Out-Null
            }
            foreach ($footer in $section.Footers) {
                $footer.Range.Fields.Update() | Out-Null
            }
        }
    }
    if ($SaveDocument) {
        $document.Save()
    }
    $document.ExportAsFixedFormat($OutputPdf, 17)
    $document.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output $OutputPdf
