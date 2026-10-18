/* Gera o PDF da ficha de horas. Funciona no navegador e no Node (para testes).
   Uso: ReportPdf.build(jsPDF, autoTable, report, { name, showAmount, rateCents, generatedAt }) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logic.js'));
  else root.ReportPdf = factory(root.Logic);
})(typeof self !== 'undefined' ? self : this, function (Logic) {
  'use strict';

  var INK = [16, 24, 40];
  var MUTED = [91, 102, 114];
  var BRAND = [43, 45, 49];      // cabeçalho cinza-escuro
  var ACCENT = [16, 163, 111];   // menta mais escura, legível no papel
  var LINE = [208, 214, 224];
  var ZEBRA = [243, 246, 245];
  var SOFT = [225, 244, 236];    // fundo claro de totais

  // As fontes padrão do PDF só cobrem Latin-1 + alguns símbolos. O resto é simplificado
  // (ex.: "ł" vira "l") para nunca sair texto quebrado no relatório.
  var EXTRA_OK = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  var SPECIAL = { 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ħ': 'h', 'Ħ': 'H' };

  function okChar(ch) {
    var c = ch.charCodeAt(0);
    return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || EXTRA_OK.indexOf(ch) >= 0;
  }
  function pdfSafe(str) {
    var s = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
    return Array.from(s).map(function (ch) {
      if (okChar(ch)) return ch;
      if (SPECIAL[ch]) return SPECIAL[ch];
      var base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return base.length === 1 && okChar(base) ? base : '?';
    }).join('');
  }

  function build(JsPDF, autoTable, report, opts) {
    opts = opts || {};
    var doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var M = 14;

    // Cabeçalho
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text('Ficha de horas', M, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    var y = 27;
    if (opts.name && opts.name.trim()) {
      doc.text('Nome: ' + pdfSafe(opts.name), M, y); y += 5.5;
    }
    doc.text('Período: de ' + Logic.formatDateBR(report.start) + ' a ' + Logic.formatDateBR(report.end), M, y);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(0.8);
    doc.line(M, y + 4, pageW - M, y + 4);

    // Tabela principal: uma linha por dia e serviço
    var body = report.rows.map(function (r) {
      return {
        date: r.firstOfDay ? Logic.formatDateBR(r.date) : '',
        weekday: r.firstOfDay ? Logic.weekdayName(r.date) : '',
        service: r.jobId ? pdfSafe(r.jobName) : '-',
        hours: r.jobId ? Logic.formatMinutes(r.minutes) : '-',
        note: pdfSafe(r.note),
        _day: r.dayIndex
      };
    });

    autoTable(doc, {
      startY: y + 9,
      margin: { left: M, right: M, top: 14, bottom: 18 },
      theme: 'grid',
      columns: [
        { header: 'Data', dataKey: 'date' },
        { header: 'Dia', dataKey: 'weekday' },
        { header: 'Serviço', dataKey: 'service' },
        { header: 'Horas', dataKey: 'hours' },
        { header: 'Observação', dataKey: 'note' }
      ],
      body: body,
      foot: [[
        { content: 'TOTAL DE HORAS', colSpan: 3, styles: { halign: 'right' } },
        { content: Logic.formatMinutes(report.totalMinutes), styles: { halign: 'right' } },
        { content: '= ' + Logic.formatDecimalHours(report.totalMinutes) + ' h', styles: { halign: 'left', fontStyle: 'normal' } }
      ]],
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 2.4, bottom: 2.4, left: 2.6, right: 2.6 }, textColor: INK, lineColor: LINE, lineWidth: 0.1, valign: 'middle' },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: BRAND },
      footStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', fontSize: 10.5 },
      columnStyles: {
        date: { cellWidth: 25 },
        weekday: { cellWidth: 22 },
        service: { cellWidth: 50 },
        hours: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        note: { cellWidth: 'auto' }
      },
      didParseCell: function (data) {
        if (data.section === 'head' && data.column.dataKey === 'hours') data.cell.styles.halign = 'right';
        if (data.section === 'body') {
          data.cell.styles.fillColor = (data.row.raw._day % 2) ? ZEBRA : [255, 255, 255];
        }
      }
    });

    // Resumo do período
    var afterY = doc.lastAutoTable.finalY;
    var summaryRows = [
      ['Total de horas', Logic.formatMinutes(report.totalMinutes) + '  (' + Logic.formatDecimalHours(report.totalMinutes) + ' h)'],
      ['Dias trabalhados', String(report.workedDays)]
    ];
    if (opts.showAmount && opts.rateCents) {
      summaryRows.push(['Valor por hora', Logic.formatMoneyCents(opts.rateCents)]);
      summaryRows.push(['Valor a receber', Logic.formatMoneyCents(Logic.amountCents(report.totalMinutes, opts.rateCents))]);
    }
    var need = 12 + summaryRows.length * 8 + (report.byJob.length + 1) * 9 + 16;
    if (afterY + need > pageH - 18) { doc.addPage(); afterY = 14; } else { afterY += 6; }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text('Resumo do período', M, afterY + 5);
    autoTable(doc, {
      startY: afterY + 8,
      margin: { left: M, right: M, bottom: 18 },
      theme: 'plain',
      body: summaryRows,
      styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 1.6, bottom: 1.6, left: 0, right: 2 }, textColor: INK },
      columnStyles: { 0: { cellWidth: 45, textColor: MUTED }, 1: { fontStyle: 'bold' } }
    });

    // Por serviço
    if (report.byJob.length) {
      var y2 = doc.lastAutoTable.finalY + 7;
      var cols = [
        { header: 'Serviço', dataKey: 'name' },
        { header: 'Endereço', dataKey: 'address' },
        { header: 'Dias', dataKey: 'days' },
        { header: 'Horas', dataKey: 'hours' }
      ];
      var rows = report.byJob.map(function (b) {
        return { name: pdfSafe(b.name), address: pdfSafe(b.address) || '-', days: String(b.days), hours: Logic.formatMinutes(b.minutes) };
      });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      if (y2 + 30 > pageH - 18) { doc.addPage(); y2 = 14; }
      doc.text('Por serviço', M, y2 + 5);
      autoTable(doc, {
        startY: y2 + 8,
        margin: { left: M, right: M, bottom: 18 },
        theme: 'grid',
        columns: cols,
        body: rows,
        styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 }, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
        headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold', lineColor: LINE },
        columnStyles: { name: { cellWidth: 48 }, address: { cellWidth: 'auto' }, days: { cellWidth: 16, halign: 'right' }, hours: { cellWidth: 22, halign: 'right', fontStyle: 'bold' } },
        didParseCell: function (data) {
          if (data.section === 'head' && (data.column.dataKey === 'days' || data.column.dataKey === 'hours')) data.cell.styles.halign = 'right';
        }
      });
    }

    // Rodapé em todas as páginas
    var pages = doc.getNumberOfPages();
    var generated = opts.generatedAt ? Logic.formatDateBR(opts.generatedAt) : '';
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      if (generated) doc.text('Gerado em ' + generated, M, pageH - 9);
      doc.text('Página ' + i + ' de ' + pages, pageW - M, pageH - 9, { align: 'right' });
    }
    return doc;
  }

  return { build: build, pdfSafe: pdfSafe };
});
