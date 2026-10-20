import type { Career } from '../types';

export function exportFavorites(items: Career[]) {
  let text = 'МОЯТ КАРИЕРЕН ПЛАН ЗА 2030+\n===================================\n\n';
  items.forEach((item, idx) => {
    text += `${idx + 1}. ${item.title} [${item.catLabel}]\n`;
    text += `   - Описание: ${item.fullDesc}\n`;
    text += `   - Средна Заплата: $${item.salary.toLocaleString()} USD / година\n`;
    text += `   - Прогнозиран Ръст: +${item.growth}%\n`;
    text += `   - Необходими Умения: ${item.skills.join(', ')}\n\n`;
  });

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'My_Future_Career_Plan_2030.txt';
  a.click();
  URL.revokeObjectURL(url);
}
