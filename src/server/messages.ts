import { DEFAULT_LANG, isLang, type Lang } from '../lib/i18n/lang';

/**
 * Language of a form request. The site's forms send the page language in Accept-Language, so a
 * reader on /pt/ gets Portuguese errors whatever the browser's own preference.
 */
export function requestLang(request: Request): Lang {
  const first = (request.headers.get('accept-language') ?? '')
    .split(/[,;-]/)[0]
    ?.trim()
    .toLowerCase();
  return first && isLang(first) ? first : DEFAULT_LANG;
}

const en = {
  tooMany: 'Too many requests. Try again in a minute.',
  tooLarge: 'The request is too large.',
  badJson: 'The request body is not valid JSON.',
  failed: 'Something failed on our side. Please try again in a minute.',
  notHuman: 'The anti-spam check failed. Reload the page and try again.',
  checkFields: 'Check the highlighted fields.',
  checkField: 'Check this field.',
  suggestionThanks: 'Thank you. An editor will review the outlet, usually within a week.',
  correctionThanks: 'Thank you. An editor will review the correction.',
  notOnSale: 'Sponsorships are not on sale yet. Write to us instead.',
  holdsOpen: 'You already have checkouts open. Finish one, or try again in 30 minutes.',
  slotsFull: 'All places in this category are taken. Choose another category or write to us.',
  paymentFailed: 'The payment page could not be opened. Please try again in a minute.',
  /** What to tell a person for each form field; schema messages are for developers. */
  fields: {
    outlet_name: 'Enter the outlet name.',
    url: 'Enter the full address, starting with https://.',
    contact_email: 'Enter a valid e-mail address.',
    country_iso: 'Choose a country.',
    category: 'Choose a category.',
    plan: 'Choose monthly or yearly.',
    outlet_id: 'Choose an outlet from the list.',
    field: 'Choose what is wrong.',
    message: 'Describe the correction in up to 2,000 characters.',
    note: 'Keep the note under 1,000 characters.',
    turnstile_token: 'Complete the anti-spam check.',
  } as Record<string, string>,
};

export type Messages = typeof en;

const pt: Messages = {
  tooMany: 'Muitas solicitações. Tente de novo em um minuto.',
  tooLarge: 'A solicitação é grande demais.',
  badJson: 'O corpo da solicitação não é um JSON válido.',
  failed: 'Algo falhou do nosso lado. Tente de novo em um minuto.',
  notHuman: 'A verificação antispam falhou. Recarregue a página e tente de novo.',
  checkFields: 'Confira os campos destacados.',
  checkField: 'Confira este campo.',
  suggestionThanks: 'Obrigado. Um editor vai analisar o veículo, em geral em até uma semana.',
  correctionThanks: 'Obrigado. Um editor vai analisar a correção.',
  notOnSale: 'Os patrocínios ainda não estão à venda. Escreva para nós.',
  holdsOpen: 'Você já tem checkouts abertos. Termine um deles ou tente de novo em 30 minutos.',
  slotsFull:
    'Todas as vagas desta categoria estão ocupadas. Escolha outra categoria ou escreva para nós.',
  paymentFailed: 'Não foi possível abrir a página de pagamento. Tente de novo em um minuto.',
  fields: {
    outlet_name: 'Informe o nome do veículo.',
    url: 'Informe o endereço completo, começando com https://.',
    contact_email: 'Informe um e-mail válido.',
    country_iso: 'Escolha um país.',
    category: 'Escolha uma categoria.',
    plan: 'Escolha mensal ou anual.',
    outlet_id: 'Escolha um veículo da lista.',
    field: 'Escolha o que está errado.',
    message: 'Descreva a correção em até 2.000 caracteres.',
    note: 'A observação deve ter menos de 1.000 caracteres.',
    turnstile_token: 'Conclua a verificação antispam.',
  },
};

export const MESSAGES: Record<Lang, Messages> = { en, pt };
