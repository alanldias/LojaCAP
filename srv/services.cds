using my.shop as shop from '../db/schema';

service ShopService {
@odata.draft.enabled
  entity Produtos   as projection on shop.Produto;
@odata.draft.enabled
  entity Clientes   as projection on shop.Cliente;
  entity Carrinhos  as projection on shop.Carrinho;
  entity Pedidos    as projection on shop.Pedido;
  entity ItemCarrinho as projection on shop.ItemCarrinho;
  action registerCliente(nome: String, email: String, senha: String) returns String;
  action loginCliente(email: String, senha: String) returns String;
  action realizarPagamento(clienteID: UUID, tipoPagamento: shop.TipoPagamento) returns UUID;

  action mergeCarrinho(clienteID: UUID, carrinhoAnonimoID: UUID) returns { carrinhoID : UUID };

}