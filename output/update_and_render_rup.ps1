$ErrorActionPreference = "Stop"

$docx = "C:\Studybase\FitCV_Use_Case_Specification_RUP.docx"
$pdf = "C:\Studybase\FitCV\output\rup_restructure_work\FitCV_Use_Case_Specification_RUP.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $document = $word.Documents.Open($docx, $false, $false)
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
    $document.Save()
    $document.ExportAsFixedFormat($pdf, 17)
    $document.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output $pdf
