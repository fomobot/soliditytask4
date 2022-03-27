const Names = artifacts.require("Names");

module.exports = function (deployer) {
  deployer.deploy(Names, 10);
};
