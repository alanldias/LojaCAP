using my.shop as shop from '../db/schema';

service ShopService {
@odata.draft.enabled
  entity Produtos   as projection on shop.Produto;
@odata.draft.enabled
  entity Clientes   as projection on shop.Cliente;
  entity Carrinhos  as projection on shop.Carrinho;
  entity Pedidos    as projection on shop.Pedido;
}