// srv/services.cds
using my.shop as shop from '../db/schema';

service ShopService {

  @odata.draft.enabled
  entity Produtos   as projection on shop.Produto;

  @odata.draft.enabled
  entity Clientes   as projection on shop.Cliente;

  entity Carrinhos  as projection on shop.Carrinho;

  @odata.draft.enabled
  entity Pedidos    as projection on shop.Pedido {
    *,
  
    statusCriticality : Integer 
  };
  
 entity ItemCarrinho as projection on shop.ItemCarrinho;

 entity StatusPedidoEnum as projection on shop.StatusPedidoEnum;


  // Suas ações personalizadas existentes
  action registerCliente(nome: String, email: String, senha: String) returns String;
  action loginCliente(email: String, senha: String) returns String;
  action realizarPagamento(clienteID: UUID, tipoPagamento: shop.TipoPagamento) returns UUID;
  action mergeCarrinho(clienteID: UUID, carrinhoAnonimoID: UUID) returns { carrinhoID : UUID };
  action realizarPagamentoItemUnico(
        clienteID     : UUID, // Para associar o Pedido ao Cliente
        tipoPagamento : shop.TipoPagamento,
        produtoID     : UUID,
        quantidade    : Integer,
        precoUnitario : Decimal // Passar o preço unitário do momento da compra
    ) returns UUID;

}