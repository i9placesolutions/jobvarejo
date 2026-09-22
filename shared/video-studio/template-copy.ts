import type {FlyerRecipe} from './flyer-recipes'

// Esta arte foi extraída de uma campanha de cliente; o selo é genérico,
// mas o nome do projeto de origem não pode virar marca/roteiro compartilhado.
export function videoTemplateCopy(recipe:FlyerRecipe) {
  if(recipe.sourceProject==='6a1de6f4-4cd8-46d2-b5d7-0a19c1afbcc4')return {name:'Especial Dia do Cliente',title:'ESPECIAL DIA DO CLIENTE'}
  return {name:recipe.name,title:recipe.campaign}
}
