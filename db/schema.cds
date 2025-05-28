namespace my.shop;

using { cuid, managed } from '@sap/cds/common';

// Tipos enumerados
type TipoPagamento : String enum {
  PIX;
  CARTAO;
  BOLETO;
}

type StatusPedido : String enum {
  AGUARDANDO_PAGAMENTO;
  PAGO;
  ENVIADO;
  ENTREGUE;
  CANCELADO;
}

entity StatusPedidoEnum {
  key code : String;
  text     : String;
}

// Entidades principais
entity Produto : cuid, managed{
  nome         : String      not null;
  descricao    : String;
  preco        : Decimal(10,2) not null;
  estoque      : Integer     not null;
  imagemURL    : String;
  categoria   : String;
}

entity Cliente  : cuid, managed {
  nome          : String      not null;
  email         : String      not null;
  senha         : String      not null; // será criptografada no back-end
}

entity Carrinho : cuid, managed {
  cliente       : Association to Cliente; // pode ser nulo se for anônimo
  sessionID     : String;                // pode ser nulo
  itens         : Composition of many ItemCarrinho
                  on itens.carrinho = $self;
}

entity ItemCarrinho  : cuid, managed {
  carrinho      : Association to Carrinho not null;
  produto       : Association to Produto  not null;
  quantidade    : Integer                 not null;
  precoUnitario : Decimal(10,2);
}

entity Pedido  : cuid, managed {
  cliente      : Association to Cliente   not null;
  total        : Decimal(10,2)            not null;
  pagamento    : TipoPagamento            not null;
  status       : StatusPedido             not null;
  itens        : Composition of many ItemPedido
                on itens.pedido = $self;

  @cds.api.ignore
  statusCriticality : Integer;
}

entity ItemPedido : cuid, managed{
  pedido          : Association to Pedido   not null;
  produto         : Association to Produto  not null;
  quantidade      : Integer                 not null;
  precoUnitario   : Decimal(10,2)           not null;
}
